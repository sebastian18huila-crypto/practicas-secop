"""
pipeline.py — Motor principal de detección SECOP II multiempresa.
"""
import os
import ssl
import smtplib
import faiss
import requests
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from config import settings
from database import (
    ConfigScheduler, DestinatarioNotificacion, Empresa, EstadoNotificacion,
    MatchOportunidad, ServicioCatalogo, SessionLocal,
)
from models import MotorIA

os.environ["HF_TOKEN"] = settings.HF_TOKEN


# ── Columnas SECOP ────────────────────────────────────────────────────────────
def buscar_columna(df: pd.DataFrame, opciones: list) -> str | None:
    for op in opciones:
        if op in df.columns:
            vals = df[op].dropna().astype(str).str.strip().str.lower()
            if len(vals[~vals.isin(["nan", "none", ""])]) > 0:
                return op
    for op in opciones:
        if op in df.columns:
            return op
    return None


def detectar_columnas(df: pd.DataFrame) -> dict:
    return {
        "descripcion": buscar_columna(df, [
            "descripci_n_del_procedimiento",
            "descripcion_del_procedimiento",
            "descripcion_del_proceso",
            "objeto_del_contrato",
        ]),
        "nombre": buscar_columna(df, [
            "nombre_del_procedimiento",
            "nombre_del_proceso",
        ]),
        "estado": buscar_columna(df, [
            "estado_de_apertura_del_proceso",
            "estado_del_procedimiento",
            "estado_del_proceso",
        ]),
        "fecha": buscar_columna(df, [
            "fecha_de_apertura_efectiva",
            "fecha_de_apertura_de_respuesta",
            "fecha_de_recepcion_de",
        ]),
        "categoria": buscar_columna(df, [
            "codigo_principal_de_categoria",
            "categorias_adicionales",
        ]),
        "id": buscar_columna(df, ["id_del_proceso", "proceso_de_compra"]),
        "entidad": buscar_columna(df, ["entidad"]),
        "departamento": buscar_columna(df, ["departamento_entidad"]),
        "ciudad": buscar_columna(df, ["ciudad_entidad"]),
        "modalidad": buscar_columna(df, ["modalidad_de_contratacion"]),
        "valor": buscar_columna(df, ["precio_base", "valor_total_adjudicacion"]),
    }


# ── SECOP fetch ───────────────────────────────────────────────────────────────
def fetch_secop(url: str, max_intentos: int = 3) -> list | None:
    import time
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; PracticasSecopBot/1.0)",
        "X-App-Token": "qheEaVtMfkuT6werib17afOVT",
    }
    for intento in range(1, max_intentos + 1):
        try:
            print(f"  [SECOP] Intento {intento}/{max_intentos}: {url[:60]}...")
            r = requests.get(url, headers=headers, timeout=30)
            if r.status_code == 200:
                data = r.json()
                print(f"  [SECOP] OK — {len(data)} registros recibidos")
                return data
            elif r.status_code == 503:
                time.sleep(15 * intento)
            else:
                print(f"  [SECOP] HTTP {r.status_code}")
                return None
        except Exception as e:
            print(f"  [SECOP] Error: {e}")
            time.sleep(10)
    return None


# ── Fecha limpia ──────────────────────────────────────────────────────────────
def extraer_fecha(row: pd.Series, cols: dict) -> str:
    for cf in [cols.get("fecha"), "fecha_de_apertura_efectiva", "fecha_de_apertura_de_respuesta"]:
        if cf and cf in row.index:
            v = str(row[cf]).strip()
            if v and v.lower() not in ("nan", "none", ""):
                return v.split("T")[0] if "T" in v else v
    return "Ver pliegos"


# ── Notificaciones ────────────────────────────────────────────────────────────
def _credenciales_correo(empresa: Empresa) -> tuple[str, str]:
    correo_emisor = empresa.correo_emisor or settings.CORREO_EMISOR
    correo_contrasena = empresa.correo_contrasena or settings.CORREO_CONTRASENA
    return correo_emisor, correo_contrasena


def enviar_correo(empresa: Empresa, destinatarios: list[DestinatarioNotificacion], matches: list) -> bool:
    correo_emisor, correo_contrasena = _credenciales_correo(empresa)
    correos = [d.email for d in destinatarios if d.activo and d.recibe_email and d.email]

    if not correo_emisor or not correo_contrasena or not correos:
        print(f"[Correo] {empresa.nombre}: sin configuración o destinatarios")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"[{empresa.nombre}] {len(matches)} oportunidades SECOP II"
    msg["From"]    = correo_emisor
    msg["To"]      = ", ".join(correos)

    color = empresa.color_primary or settings.EMPRESA_COLOR_PRIMARY
    filas = "".join([
        f"""<tr>
          <td style="padding:8px;border-bottom:1px solid #eee">{m['entidad']}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;font-family:monospace;font-size:11px">{m['id_proceso']}</td>
          <td style="padding:8px;border-bottom:1px solid #eee">{m['servicio'][:60]}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;color:#059669;font-weight:bold">{round(m['score']*100,1)}%</td>
          <td style="padding:8px;border-bottom:1px solid #eee">{m['fecha_limite']}</td>
        </tr>"""
        for m in matches
    ])

    html = f"""<html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
    <div style="max-width:900px;margin:0 auto;background:white;border-radius:10px;padding:28px">
      <h2 style="color:{color};margin-top:0">{empresa.nombre} — SECOP II IA</h2>
      <p>{len(matches)} nuevas oportunidades detectadas automáticamente:</p>
      <table width="100%" style="border-collapse:collapse;font-size:13px">
        <tr style="background:{color};color:white">
          <th style="padding:10px;text-align:left">Entidad</th>
          <th style="padding:10px;text-align:left">ID SECOP</th>
          <th style="padding:10px;text-align:left">Servicio</th>
          <th style="padding:10px;text-align:left">Match</th>
          <th style="padding:10px;text-align:left">Cierre</th>
        </tr>
        {filas}
      </table>
      <p style="margin-top:24px">
        <a href="https://community.secop.gov.co/STS/Users/Login/Index?SkinName=CCE"
           style="background:{color};color:white;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:bold">
          Ir a SECOP II
        </a>
      </p>
      <p style="font-size:11px;color:#9ca3af;margin-top:20px">
        Este correo fue generado automáticamente para {empresa.nombre}.
      </p>
    </div>
    </body></html>"""

    msg.attach(MIMEText(html, "html"))
    try:
        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL(settings.SMTP_SERVER, 465, context=ctx) as s:
            s.login(correo_emisor, correo_contrasena)
            s.sendmail(correo_emisor, correos, msg.as_string())
        print(f"[Correo] {empresa.nombre}: enviado OK")
        return True
    except Exception as e1:
        try:
            s = smtplib.SMTP(settings.SMTP_SERVER, 587, timeout=30)
            s.ehlo(); s.starttls(); s.ehlo()
            s.login(correo_emisor, correo_contrasena)
            s.sendmail(correo_emisor, correos, msg.as_string())
            s.quit()
            print(f"[Correo] {empresa.nombre}: enviado OK (587)")
            return True
        except Exception as e2:
            print(f"[Correo] {empresa.nombre}: error {e1} / {e2}")
            return False


def enviar_whatsapp(empresa: Empresa, destinatarios: list[DestinatarioNotificacion], matches: list) -> bool:
    token = empresa.token_whatsapp or settings.TOKEN_WHATSAPP
    url_api = empresa.url_api_whatsapp or settings.URL_API_WHATSAPP
    telefonos = [d.telefono_whatsapp for d in destinatarios if d.activo and d.recibe_whatsapp and d.telefono_whatsapp]

    if not token or token == "TU_TOKEN_AQUI" or not telefonos:
        print(f"[WhatsApp] {empresa.nombre}: sin configuración o destinatarios")
        return False

    texto = f"*{empresa.nombre} SECOP IA*\n{len(matches)} nuevas licitaciones:\n\n"
    for i, m in enumerate(matches[:5], 1):
        texto += (
            f"*{i}. {m['entidad'][:40]}*\n"
            f"ID: {m['id_proceso']}\n"
            f"Match: {round(m['score']*100,1)}%\n"
            f"Cierre: {m['fecha_limite']}\n\n"
        )

    enviados = 0
    for telefono in telefonos:
        try:
            requests.get(url_api, params={
                "phone":  telefono,
                "text":   texto,
                "apikey": token,
            }, timeout=20)
            enviados += 1
        except Exception as e:
            print(f"[WhatsApp] {empresa.nombre}: error con {telefono}: {e}")
    print(f"[WhatsApp] {empresa.nombre}: enviados {enviados}/{len(telefonos)}")
    return enviados > 0


def guardar_excel(empresa: Empresa, matches: list) -> None:
    try:
        archivo = f"Registro_CRM_{empresa.id}_{empresa.nombre.replace(' ', '_')}.xlsx"
        filas = [{
            "Empresa":           empresa.nombre,
            "Fecha Detección":   datetime.now().strftime("%Y-%m-%d %H:%M"),
            "Entidad":           m["entidad"],
            "ID SECOP II":       m["id_proceso"],
            "Servicio Sugerido": m["servicio"],
            "Afinidad IA":       f"{round(m['score']*100,1)}%",
            "Fecha Límite":      m["fecha_limite"],
            "Descripción":       m["descripcion"][:300],
        } for m in matches]
        df_nuevo = pd.DataFrame(filas)
        try:
            df_exist = pd.read_excel(archivo)
            pd.concat([df_exist, df_nuevo], ignore_index=True).to_excel(archivo, index=False)
        except FileNotFoundError:
            df_nuevo.to_excel(archivo, index=False)
        print(f"[Excel] {empresa.nombre}: actualizado OK")
    except Exception as e:
        print(f"[Excel] {empresa.nombre}: error {e}")


# ── Preparación SECOP ─────────────────────────────────────────────────────────
def _parse_fecha_filtro(valor: str | None) -> datetime | None:
    if not valor:
        return None
    try:
        return datetime.strptime(valor, "%Y-%m-%d")
    except Exception:
        return None


def _row_fecha(row: pd.Series, cols: dict) -> datetime | None:
    for cf in [cols.get("fecha"), "fecha_de_apertura_efectiva", "fecha_de_apertura_de_respuesta", "fecha_de_recepcion_de"]:
        if cf and cf in row.index:
            valor = str(row.get(cf, "")).strip()
            if valor and valor.lower() not in ("nan", "none", ""):
                try:
                    return datetime.strptime(valor.split("T")[0], "%Y-%m-%d")
                except Exception:
                    pass
    return None


def _obtener_dataframe_secop(fecha_desde: str | None = None, fecha_hasta: str | None = None) -> tuple[pd.DataFrame | None, dict | None]:
    data = None
    for url in settings.get_urls_secop():
        data = fetch_secop(url)
        if data:
            break

    if not data:
        print("[Pipeline] SECOP no disponible")
        return None, None

    df = pd.DataFrame(data)
    cols = detectar_columnas(df)

    if not cols["descripcion"] or not cols["id"]:
        print("[Pipeline] Columnas críticas no encontradas")
        print(f"  Columnas disponibles: {list(df.columns)[:10]}")
        return None, None

    print(f"[Pipeline] Columnas detectadas: desc={cols['descripcion']}, id={cols['id']}")

    df = df.dropna(subset=[cols["descripcion"]])
    hoy = datetime.now()
    fd = _parse_fecha_filtro(fecha_desde)
    fh = _parse_fecha_filtro(fecha_hasta)
    estados_abiertos = [
        "Abierto", "abierto", "ABIERTO",
        "Presentación de ofertas", "Convocatoria",
        "Publicado", "En proceso", "Activo",
        "Recepción de Ofertas",
    ]

    filtradas = []
    for _, row in df.iterrows():
        estado = str(row.get(cols["estado"], "")).strip() if cols["estado"] else ""
        fecha  = str(row.get(cols["fecha"],  "")).strip() if cols["fecha"] else ""
        es_abierto = any(e in estado for e in estados_abiertos)
        es_vigente = True
        if fecha and fecha.lower() not in ("nan", "none", ""):
            try:
                if datetime.strptime(fecha.split("T")[0], "%Y-%m-%d") < hoy:
                    es_vigente = False
            except Exception:
                pass
        fecha_row = _row_fecha(row, cols)
        if fd and fecha_row and fecha_row < fd:
            continue
        if fh and fecha_row and fecha_row >= fh + timedelta(days=1):
            continue
        if fd and not fecha_row:
            continue
        if fh and not fecha_row:
            continue
        if es_abierto and es_vigente:
            filtradas.append(row)

    df_f = pd.DataFrame(filtradas).reset_index(drop=True)
    if df_f.empty:
        print("[Pipeline] Sin licitaciones abiertas")
        return None, None
    print(f"[Pipeline] Licitaciones abiertas: {len(df_f)}")
    return df_f, cols


# ── Pipeline por empresa ──────────────────────────────────────────────────────
def _ejecutar_empresa(db, empresa: Empresa, df_f: pd.DataFrame, cols: dict, departamento: str | None = None) -> None:
    cfg = db.query(ConfigScheduler).filter_by(empresa_id=empresa.id).first()
    umbral = cfg.umbral_ia if cfg else settings.UMBRAL_SIMILITUD
    filtro_depto = departamento or (cfg.filtro_depto if cfg else None)

    servicios_db = db.query(ServicioCatalogo).filter_by(empresa_id=empresa.id, activo=True).all()
    if not servicios_db:
        print(f"[Pipeline] {empresa.nombre}: sin servicios activos")
        return

    df_empresa = df_f
    if filtro_depto:
        depto_col = cols.get("departamento")
        if depto_col:
            df_empresa = df_empresa[df_empresa[depto_col].astype(str).str.contains(filtro_depto, case=False, na=False)]
    if df_empresa.empty:
        print(f"[Pipeline] {empresa.nombre}: sin registros para filtros configurados")
        return
    df_empresa = df_empresa.reset_index(drop=True)

    print(f"[Pipeline] {empresa.nombre}: servicios={len(servicios_db)}, umbral={umbral:.0%}, licitaciones={len(df_empresa)}")

    ia = MotorIA()
    textos_servicios = [ia.enriquecer_servicio(s.nombre_servicio, s.categoria) for s in servicios_db]
    emb_svc = ia.generar_embeddings(textos_servicios)

    textos_secop = [ia.enriquecer_licitacion(row, cols) for _, row in df_empresa.iterrows()]
    emb_sec = ia.generar_embeddings(textos_secop)

    idx_faiss = faiss.IndexFlatIP(emb_svc.shape[1])
    idx_faiss.add(np.array(emb_svc))
    k = min(3, len(servicios_db))
    distancias, indices = idx_faiss.search(np.array(emb_sec), k)

    matches = []
    duplicados = 0
    bajo_score = 0

    for i, row in df_empresa.iterrows():
        id_proc = str(row.get(cols["id"], f"SEC-{i}"))

        if db.query(MatchOportunidad).filter_by(empresa_id=empresa.id, id_proceso_secop=id_proc).first():
            duplicados += 1
            continue

        best_score = float(distancias[i][0])
        best_svc = servicios_db[indices[i][0]]

        if best_score < umbral:
            bajo_score += 1
            continue

        fecha_final = extraer_fecha(row, cols)
        opp = MatchOportunidad(
            empresa_id             = empresa.id,
            id_proceso_secop       = id_proc,
            entidad_publica        = str(row.get(cols["entidad"], "N/A")) if cols["entidad"] else "N/A",
            departamento           = str(row.get(cols["departamento"], "")) if cols["departamento"] else None,
            ciudad                 = str(row.get(cols["ciudad"], "")) if cols["ciudad"] else None,
            descripcion_licitacion = str(row.get(cols["descripcion"], ""))[:1000],
            servicio_relacionado   = best_svc.nombre_servicio,
            score_ia               = best_score,
            fecha_limite           = fecha_final,
            modalidad              = str(row.get(cols["modalidad"], "")) if cols["modalidad"] else None,
            valor_estimado         = str(row.get(cols["valor"], "")) if cols["valor"] else None,
            estado_notificacion    = EstadoNotificacion.PENDIENTE,
        )

        try:
            db.add(opp)
            db.flush()
            matches.append({
                "id_proceso"  : id_proc,
                "entidad"     : opp.entidad_publica,
                "servicio"    : opp.servicio_relacionado,
                "score"       : best_score,
                "fecha_limite": fecha_final,
                "descripcion" : opp.descripcion_licitacion,
            })
        except Exception:
            db.rollback()
            duplicados += 1

    if matches:
        try:
            db.commit()
        except Exception:
            db.rollback()

    print(f"[Pipeline] {empresa.nombre}: nuevos={len(matches)}, duplicados={duplicados}, bajo_score={bajo_score}")

    if matches:
        destinatarios = db.query(DestinatarioNotificacion).filter_by(empresa_id=empresa.id, activo=True).all()
        email_ok = enviar_correo(empresa, destinatarios, matches)
        wa_ok = enviar_whatsapp(empresa, destinatarios, matches)
        guardar_excel(empresa, matches)

        estado = EstadoNotificacion.PENDIENTE
        if email_ok and wa_ok:
            estado = EstadoNotificacion.COMPLETO
        elif email_ok:
            estado = EstadoNotificacion.ENVIADO_EMAIL
        elif wa_ok:
            estado = EstadoNotificacion.ENVIADO_WA

        db.query(MatchOportunidad).filter(
            MatchOportunidad.empresa_id == empresa.id,
            MatchOportunidad.id_proceso_secop.in_([m["id_proceso"] for m in matches]),
        ).update({"estado_notificacion": estado}, synchronize_session=False)
        db.commit()


# ── Pipeline principal ────────────────────────────────────────────────────────
def ejecutar_pipeline(empresa_id: int | None = None, fecha_desde: str | None = None, fecha_hasta: str | None = None, departamento: str | None = None) -> None:
    print(f"\n{'='*60}")
    print(f"[Pipeline] Inicio: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")

    db = SessionLocal()
    try:
        empresas_q = db.query(Empresa).filter_by(activo=True)
        if empresa_id:
            empresas_q = empresas_q.filter_by(id=empresa_id)
        empresas = empresas_q.order_by(Empresa.id.asc()).all()
        if not empresas:
            print("[Pipeline] Sin empresas activas")
            return

        df_f, cols = _obtener_dataframe_secop(fecha_desde=fecha_desde, fecha_hasta=fecha_hasta)
        if df_f is None or cols is None:
            return

        for empresa in empresas:
            _ejecutar_empresa(db, empresa, df_f, cols, departamento=departamento)

    except Exception as e:
        print(f"[Pipeline] Error inesperado: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()
        print(f"[Pipeline] Fin: {datetime.now().strftime('%H:%M:%S')}\n")
