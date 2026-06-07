"""models.py — Motor IA con Singleton y matching mejorado."""
import numpy as np
from sentence_transformers import SentenceTransformer


class MotorIA:
    """
    Singleton del modelo sentence-transformers.
    Se carga una sola vez en memoria para todo el proceso.

    Mejoras de matching:
    - Texto enriquecido: título + objeto + categoría + entidad + modalidad
    - Expansión semántica: sinónimos técnicos colombianos
    - Normalización de embeddings para cosine similarity exacta
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            print("[IA] Cargando modelo sentence-transformers...")
            cls._instance.model = SentenceTransformer(
                "paraphrase-multilingual-mpnet-base-v2"
            )
            print("[IA] Modelo listo")
        return cls._instance

    def generar_embeddings(self, textos: list) -> np.ndarray:
        return self.model.encode(
            textos,
            normalize_embeddings=True,
            batch_size=32,
            show_progress_bar=len(textos) > 50,
        )

    def enriquecer_servicio(self, nombre: str, categoria: str = None) -> str:
        """
        Expande el texto del servicio con sinónimos y términos relacionados
        para mejorar el matching semántico con licitaciones colombianas.
        """
        expansiones = {
            "SAP": "SAP ERP sistema empresarial módulos financiero presupuesto contratación",
            "Cloud": "nube infraestructura AWS Azure Google servidores virtualización",
            "Cyber": "seguridad informática ciberseguridad protección datos vulnerabilidades",
            "BI": "inteligencia negocios analítica reportes dashboards datos indicadores",
            "Dev": "desarrollo software aplicaciones sistemas web móvil programación",
            "Doc": "gestión documental expediente digital automatización procesos RPA",
        }
        extra = expansiones.get(categoria, "") if categoria else ""
        return f"{nombre}. {extra}".strip()

    def enriquecer_licitacion(self, row: dict, cols: dict) -> str:
        """
        Construye texto enriquecido de la licitación para mejor matching.
        Usa más campos para dar más contexto semántico al modelo.
        """
        partes = []

        titulo = str(row.get(cols.get("nombre", ""), "")).strip()
        if titulo:
            partes.append(f"Licitación: {titulo}")

        desc = str(row.get(cols.get("descripcion", ""), "")).strip()
        if desc:
            partes.append(f"Objeto: {desc[:400]}")

        cat = str(row.get(cols.get("categoria", ""), "")).strip()
        if cat and cat not in ("None", "nan", ""):
            partes.append(f"Categoría: {cat}")

        modal = str(row.get(cols.get("modalidad", ""), "")).strip()
        if modal and modal not in ("None", "nan", ""):
            partes.append(f"Modalidad: {modal}")

        entidad = str(row.get(cols.get("entidad", ""), "")).strip()
        if entidad:
            partes.append(f"Entidad: {entidad}")

        return ". ".join(partes)
