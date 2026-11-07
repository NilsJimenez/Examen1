import time
import threading
from datetime import datetime
from typing import List, Dict, Any, Set

class PushNotificationHub:
    """
    Gestor central en tiempo real de notificaciones Push para dispositivos móviles (Android/iOS).
    Almacena eventos disparados desde la Web o el Backend y los entrega a cada dispositivo móvil
    conectado para que los muestre en el panel nativo de notificaciones del sistema operativo.
    """
    def __init__(self):
        self._lock = threading.Lock()
        self._counter = int(time.time() * 10) % 100000
        self._notifications: List[Dict[str, Any]] = []
        self._delivered_by_device: Dict[str, Set[int]] = {}
        self._device_first_seen: Dict[str, float] = {}

    def emitir(
        self,
        titulo: str,
        cuerpo: str,
        categoria: str = "general",
        rol_destino: str = "TODOS",
        referencia: str = ""
    ) -> Dict[str, Any]:
        with self._lock:
            self._counter += 1
            now_ts = time.time()
            notif = {
                "id": self._counter,
                "titulo": titulo,
                "cuerpo": cuerpo,
                "categoria": categoria,  # 'reserva', 'venta', 'catalogo', 'stock', 'saas', 'promo'
                "rol_destino": rol_destino,
                "referencia": referencia,
                "timestamp": now_ts,
                "fecha_hora": datetime.now().strftime("%H:%M:%S")
            }
            self._notifications.append(notif)
            # Mantener solo las últimas 100 notificaciones en memoria
            if len(self._notifications) > 100:
                self._notifications = self._notifications[-100:]
            return notif

    def obtener_pendientes(self, device_id: str, rol: str = "TODOS") -> List[Dict[str, Any]]:
        with self._lock:
            now_ts = time.time()
            if device_id not in self._device_first_seen:
                # Al conectarse por primera vez, entregar las notificaciones emitidas en los últimos 45 segundos
                self._device_first_seen[device_id] = now_ts - 45.0
                self._delivered_by_device[device_id] = set()

            delivered = self._delivered_by_device.setdefault(device_id, set())
            first_seen = self._device_first_seen[device_id]

            nuevas: List[Dict[str, Any]] = []
            for n in self._notifications:
                if n["id"] in delivered:
                    continue
                if n["timestamp"] < first_seen:
                    delivered.add(n["id"])
                    continue
                nuevas.append(n)
                delivered.add(n["id"])

            return nuevas

    def listar_historial(self, limit: int = 25) -> List[Dict[str, Any]]:
        with self._lock:
            return list(reversed(self._notifications[-limit:]))


push_hub = PushNotificationHub()


def emitir_notificacion_push(
    titulo: str,
    cuerpo: str,
    categoria: str = "general",
    rol_destino: str = "TODOS",
    referencia: str = ""
) -> Dict[str, Any]:
    return push_hub.emitir(
        titulo=titulo,
        cuerpo=cuerpo,
        categoria=categoria,
        rol_destino=rol_destino,
        referencia=referencia
    )
