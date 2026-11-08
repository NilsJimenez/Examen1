import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../offline/offline_sync_provider.dart';
import '../services/auth_service.dart';
import '../widgets/offline_status_banner.dart';
import '../widgets/recomendaciones_widget.dart';
import 'login_screen.dart';
import 'offline/catalogo_offline_screen.dart';
import 'offline/centro_sincronizacion_screen.dart';
import 'offline/pos_offline_screen.dart';
import 'offline/reserva_offline_screen.dart';
import 'roles_screen.dart';
import 'usuarios_screen.dart';
import 'sucursales_screen.dart';
import 'chatbot_screen.dart';
import 'alertas_screen.dart';
import 'reportes_screen.dart';
import 'mis_compras_screen.dart';
import 'productos_screen.dart';
import 'atributos_screen.dart';
import 'temporadas_screen.dart';
import 'encargado_dashboard_screen.dart';
import 'proveedores_screen.dart';
import 'cajero_dashboard_screen.dart';
import 'catalogo_screen.dart';
import 'inventario_screen.dart';
import 'carrito_screen.dart';
import 'mis_reservas_screen.dart';
import 'lookbook_screen.dart';
import 'notificaciones_screen.dart';
import '../services/push_notification_service.dart';

class HomeScreen extends StatefulWidget {
  final String nombre;
  final String rol;

  const HomeScreen({Key? key, required this.nombre, required this.rol}) : super(key: key);

  @override
  _HomeScreenState createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final AuthService _authService = AuthService();

  @override
  void initState() {
    super.initState();
    _checkSession();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        context.read<OfflineSyncProvider>().recargarEstadoLocal();
      }
    });
  }

  void _checkSession() async {
    final isValid = await _authService.checkSession();
    if (!isValid && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sesión expirada. Por favor, inicia sesión nuevamente.')),
      );
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (context) => const LoginScreen()),
        (route) => false,
      );
    }
  }

  void _logout() async {
    await _authService.logout();
    if (!mounted) return;
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(builder: (context) => LoginScreen()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final isAdmin = widget.rol.toLowerCase() == 'administrador';

    return Scaffold(
      backgroundColor: const Color(0xFF0D0D10),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A1A1F),
        elevation: 0,
        title: Row(
          children: [
            const Icon(Icons.checkroom, color: Color(0xFFEAB308)),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Text('FashionStore', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
                Text('VESTIDORES VIRTUALES AR', style: TextStyle(color: Color(0xFFEAB308), fontSize: 9, letterSpacing: 1.2)),
              ],
            ),
          ],
        ),
        actions: [
          ValueListenableBuilder<int>(
            valueListenable: PushNotificationService.instance.unreadCountNotifier,
            builder: (context, unreadCount, child) {
              return Stack(
                alignment: Alignment.center,
                children: [
                  IconButton(
                    icon: const Icon(Icons.notifications_outlined, color: Colors.white),
                    tooltip: 'Bandeja de Notificaciones',
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const NotificacionesScreen()),
                      );
                    },
                  ),
                  if (unreadCount > 0)
                    Positioned(
                      top: 8,
                      right: 8,
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: const BoxDecoration(
                          color: Color(0xFFEF4444),
                          shape: BoxShape.circle,
                        ),
                        child: Text(
                          unreadCount > 9 ? '9+' : '$unreadCount',
                          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                      ),
                    ),
                ],
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.white70),
            onPressed: _logout,
            tooltip: 'Cerrar Sesión',
          ),
        ],
      ),
      drawer: Drawer(
        backgroundColor: const Color(0xFF1A1A1F),
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            UserAccountsDrawerHeader(
              decoration: const BoxDecoration(color: Color(0xFF2A2A35)),
              accountName: Text(widget.nombre, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
              accountEmail: Text(widget.rol.toUpperCase(), style: const TextStyle(color: Color(0xFFEAB308), fontSize: 12)),
              currentAccountPicture: CircleAvatar(
                backgroundColor: const Color(0xFF0D0D10),
                child: Text(
                  widget.nombre.isNotEmpty ? widget.nombre[0].toUpperCase() : 'U',
                  style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                ),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.home, color: Colors.white70),
              title: const Text('Inicio', style: TextStyle(color: Colors.white)),
              onTap: () => Navigator.pop(context),
            ),
            ListTile(
              leading: const Icon(Icons.checkroom, color: Colors.white70),
              title: const Text('Catálogo', style: TextStyle(color: Colors.white)),
              onTap: () {
                Navigator.pop(context);
                Navigator.push(context, MaterialPageRoute(builder: (context) => const CatalogoScreen()));
              },
            ),
            if (!isAdmin && !widget.rol.toLowerCase().contains('encargado') && !widget.rol.toLowerCase().contains('cajero')) ...[
              ListTile(
                leading: const Icon(Icons.store, color: Colors.white70),
                title: const Text('Sucursales', style: TextStyle(color: Colors.white)),
                onTap: () => Navigator.pop(context),
              ),
              if (widget.rol == 'cliente')
                ListTile(
                  leading: const Icon(Icons.auto_fix_high, color: Color(0xFF8B5CF6)),
                  title: const Text('Arma tu Outfit (IA)', style: TextStyle(color: Color(0xFF8B5CF6), fontWeight: FontWeight.bold)),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(context, MaterialPageRoute(builder: (context) => const LookbookScreen()));
                  },
                ),
              ListTile(
                leading: const Icon(Icons.calendar_today, color: Colors.white70),
                title: const Text('Mis Reservas', style: TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.pop(context);
                  Navigator.push(context, MaterialPageRoute(builder: (context) => const MisReservasScreen()));
                },
              ),
              ListTile(
                leading: const Icon(Icons.shopping_cart, color: Colors.white70),
                title: const Text('Mi Carrito (Online)', style: TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.pop(context);
                  Navigator.push(context, MaterialPageRoute(builder: (context) => const CarritoScreen()));
                },
              ),
              ListTile(
                leading: const Icon(Icons.shopping_bag, color: Colors.white70),
                title: const Text('Mis Compras', style: TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.pop(context);
                  Navigator.push(context, MaterialPageRoute(builder: (context) => const MisComprasScreen()));
                },
              ),
            ],
            if (isAdmin || widget.rol.toLowerCase().contains('encargado') || widget.rol.toLowerCase().contains('cajero')) ...[
              const Divider(color: Color(0xFF2A2A35)),
              const Padding(
                padding: EdgeInsets.only(left: 16, top: 8, bottom: 8),
                child: Text('OPERACIONES DE TIENDA', style: TextStyle(color: Colors.grey, fontSize: 12, fontWeight: FontWeight.bold)),
              ),
              if (isAdmin || widget.rol.toLowerCase().contains('encargado'))
                ListTile(
                  leading: const Icon(Icons.store, color: Color(0xFFEAB308)),
                  title: const Text('Panel de Sucursal', style: TextStyle(color: Color(0xFFEAB308), fontWeight: FontWeight.bold)),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(context, MaterialPageRoute(builder: (context) => EncargadoDashboardScreen(rol: widget.rol)));
                  },
                ),
              if (isAdmin || widget.rol.toLowerCase().contains('encargado'))
                ListTile(
                  leading: const Icon(Icons.inventory_2, color: Colors.white70),
                  title: const Text('Inventario y Kárdex', style: TextStyle(color: Colors.white)),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(context, MaterialPageRoute(builder: (context) => const InventarioScreen()));
                  },
                ),
              if (isAdmin || widget.rol.toLowerCase().contains('encargado'))
                ListTile(
                  leading: const Icon(Icons.warning_amber_rounded, color: Colors.redAccent),
                  title: const Text('Alertas de Stock', style: TextStyle(color: Colors.white)),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(context, MaterialPageRoute(builder: (context) => const AlertasScreen()));
                  },
                ),
              if (isAdmin || widget.rol.toLowerCase().contains('encargado'))
                ListTile(
                  leading: const Icon(Icons.insights, color: Color(0xFFEAB308)),
                  title: const Text('Reportes e Indicadores', style: TextStyle(color: Colors.white)),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(context, MaterialPageRoute(builder: (context) => ReportesScreen(rol: widget.rol)));
                  },
                ),
              if (isAdmin || widget.rol.toLowerCase().contains('cajero'))
                ListTile(
                  leading: const Icon(Icons.point_of_sale, color: Colors.white70),
                  title: const Text('Panel de Caja', style: TextStyle(color: Colors.white)),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(context, MaterialPageRoute(builder: (context) => CajeroDashboardScreen(rol: widget.rol)));
                  },
                ),
            ],
            Consumer<OfflineSyncProvider>(
              builder: (context, offlineProv, _) {
                final alertasCola =
                    offlineProv.pendientesCount + offlineProv.conflictosCount;

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Divider(color: Color(0xFF2A2A35)),
                    const Padding(
                      padding: EdgeInsets.only(left: 16, top: 8, bottom: 8),
                      child: Text(
                        'MODO OFFLINE & SQLITE',
                        style: TextStyle(
                          color: Color(0xFFF59E0B),
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    ListTile(
                      leading: const Icon(Icons.inventory, color: Color(0xFF10B981)),
                      title: const Text(
                        'Catálogo y Stock Local',
                        style: TextStyle(color: Colors.white),
                      ),
                      subtitle: const Text(
                        'Consulta instantánea en SQLite',
                        style: TextStyle(color: Colors.grey, fontSize: 11),
                      ),
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => const CatalogoOfflineScreen(),
                          ),
                        );
                      },
                    ),
                    ListTile(
                      leading: const Icon(Icons.payments_outlined, color: Color(0xFFEAB308)),
                      title: const Text(
                        'POS Offline (Efectivo)',
                        style: TextStyle(
                          color: Color(0xFFEAB308),
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      subtitle: const Text(
                        'Ventas al contado sin conexión',
                        style: TextStyle(color: Colors.grey, fontSize: 11),
                      ),
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => const PosOfflineScreen(),
                          ),
                        );
                      },
                    ),
                    ListTile(
                      leading: const Icon(Icons.bookmark_add_outlined, color: Color(0xFFA78BFA)),
                      title: const Text(
                        'Registrar Reserva Offline',
                        style: TextStyle(color: Colors.white),
                      ),
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => const ReservaOfflineScreen(),
                          ),
                        );
                      },
                    ),
                    ListTile(
                      leading: Icon(
                        offlineProv.conflictosCount > 0
                            ? Icons.warning_amber_rounded
                            : Icons.sync_alt,
                        color: offlineProv.conflictosCount > 0
                            ? Colors.redAccent
                            : const Color(0xFF8B5CF6),
                      ),
                      title: const Text(
                        'Cola y Conflictos Sync',
                        style: TextStyle(color: Colors.white),
                      ),
                      trailing: alertasCola > 0
                          ? Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 3,
                              ),
                              decoration: BoxDecoration(
                                color: offlineProv.conflictosCount > 0
                                    ? Colors.redAccent
                                    : const Color(0xFFEAB308),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                '$alertasCola',
                                style: TextStyle(
                                  color: offlineProv.conflictosCount > 0
                                      ? Colors.white
                                      : Colors.black,
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            )
                          : null,
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => const CentroSincronizacionScreen(),
                          ),
                        );
                      },
                    ),
                  ],
                );
              },
            ),
            if (isAdmin) ...[
              const Divider(color: Color(0xFF2A2A35)),
              const Padding(
                padding: EdgeInsets.only(left: 16, top: 8, bottom: 8),
                child: Text('ADMINISTRACIÓN', style: TextStyle(color: Colors.grey, fontSize: 12, fontWeight: FontWeight.bold)),
              ),
              ListTile(
                leading: const Icon(Icons.shopping_bag, color: Color(0xFFEAB308)),
                title: const Text('Catálogo (Gestión)', style: TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.pop(context);
                  Navigator.push(context, MaterialPageRoute(builder: (context) => const ProductosScreen()));
                },
              ),
              ListTile(
                leading: const Icon(Icons.style, color: Color(0xFFEAB308)),
                title: const Text('Atributos (Catálogo)', style: TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.pop(context);
                  Navigator.push(context, MaterialPageRoute(builder: (context) => const AtributosScreen()));
                },
              ),
              ListTile(
                leading: const Icon(Icons.beach_access, color: Color(0xFFEAB308)),
                title: const Text('Temporadas y Colecciones', style: TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.pop(context);
                  Navigator.push(context, MaterialPageRoute(builder: (context) => const TemporadasScreen()));
                },
              ),
              ListTile(
                leading: const Icon(Icons.local_shipping, color: Color(0xFFEAB308)),
                title: const Text('Proveedores', style: TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.pop(context);
                  Navigator.push(context, MaterialPageRoute(builder: (context) => const ProveedoresScreen()));
                },
              ),
              ListTile(
                leading: const Icon(Icons.admin_panel_settings, color: Color(0xFFEAB308)),
                title: const Text('Gestionar Roles', style: TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.pop(context);
                  Navigator.push(context, MaterialPageRoute(builder: (context) => const RolesScreen()));
                },
              ),
              ListTile(
                leading: const Icon(Icons.manage_accounts, color: Color(0xFFEAB308)),
                title: const Text('Personal Interno', style: TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.pop(context);
                  Navigator.push(context, MaterialPageRoute(builder: (context) => const UsuariosScreen()));
                },
              ),
              ListTile(
                leading: const Icon(Icons.storefront, color: Color(0xFFEAB308)),
                title: const Text('Ciudades y Sucursales', style: TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.pop(context);
                  Navigator.push(context, MaterialPageRoute(builder: (context) => const SucursalesScreen()));
                },
              ),
            ],
          ],
        ),
      ),
      body: Column(
        children: [
          const OfflineStatusBanner(),
          _buildTopGreetingBar(),
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildHeroSection(),
                  if (widget.rol == 'cliente') ...[
                    const SizedBox(height: 30),
                    const RecomendacionesWidget(),
                  ],
                  const SizedBox(height: 30),
                  _buildCatalogSection(),
                  const SizedBox(height: 40),
                ],
              ),
            ),
          ),
        ],
      ),
      floatingActionButton: widget.rol == 'cliente' ? FloatingActionButton(
        backgroundColor: const Color(0xFFEAB308),
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const ChatbotScreen()),
          );
        },
        child: const Icon(Icons.smart_toy, color: Colors.black),
      ) : null,
    );
  }

  // =========================================================================
  // BARRA SUPERIOR DE SALUDO Y CAMPANITA (ESTILO IMAGEN)
  // =========================================================================
  Widget _buildTopGreetingBar() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 16, 16, 14),
      decoration: const BoxDecoration(
        color: Color(0xFF131317),
        border: Border(
          bottom: BorderSide(color: Color(0xFF22222B), width: 1),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Izquierda: Hola, [Nombre] y subtitulo
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Hola, ${widget.nombre}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    letterSpacing: -0.3,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    const Icon(Icons.checkroom, color: Color(0xFFEAB308), size: 14),
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(
                        'FashionStore • ${widget.rol.toUpperCase()}',
                        style: const TextStyle(
                          color: Color(0xFF94A3B8),
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Derecha: (?), 🔔 (campanita), 💬 (asistente), [Avatar Iniciales]
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              // 1. Ayuda (?)
              IconButton(
                icon: const Icon(Icons.help_outline, color: Colors.white70, size: 22),
                tooltip: 'Ayuda',
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                onPressed: () => _mostrarAyudaUsuario(),
              ),

              // 2. Campanita 🔔 con Badge de Conteo Reactivo
              ValueListenableBuilder<int>(
                valueListenable: PushNotificationService.instance.unreadCountNotifier,
                builder: (context, unreadCount, _) {
                  return Stack(
                    alignment: Alignment.center,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.notifications_none_rounded, color: Colors.white, size: 24),
                        tooltip: 'Notificaciones',
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const NotificacionesScreen()),
                          );
                        },
                      ),
                      if (unreadCount > 0)
                        Positioned(
                          top: 4,
                          right: 4,
                          child: Container(
                            padding: const EdgeInsets.all(3.5),
                            decoration: const BoxDecoration(
                              color: Color(0xFF2563EB),
                              shape: BoxShape.circle,
                            ),
                            child: Text(
                              unreadCount > 9 ? '9+' : '$unreadCount',
                              style: const TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ),
                    ],
                  );
                },
              ),

              // 3. Chat Asistente 💬
              IconButton(
                icon: const Icon(Icons.chat_bubble_outline_rounded, color: Colors.white70, size: 21),
                tooltip: 'Chatbot IA Asistente',
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const ChatbotScreen()),
                  );
                },
              ),
              const SizedBox(width: 6),

              // 4. Avatar Circular con Iniciales en Azul Oscuro [VQ]
              Builder(
                builder: (btnContext) => GestureDetector(
                  onTap: () {
                    Scaffold.of(btnContext).openDrawer();
                  },
                  child: Container(
                    width: 36,
                    height: 36,
                    decoration: const BoxDecoration(
                      color: Color(0xFF1E3A8A),
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      _obtenerIniciales(widget.nombre),
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _obtenerIniciales(String nombre) {
    if (nombre.trim().isEmpty) return 'FS';
    final partes = nombre.trim().split(RegExp(r'\s+'));
    if (partes.length >= 2) {
      return '${partes[0][0]}${partes[1][0]}'.toUpperCase();
    }
    return nombre.length >= 2 ? nombre.substring(0, 2).toUpperCase() : nombre[0].toUpperCase();
  }

  void _mostrarAyudaUsuario() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1A1A1F),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: const [
                Icon(Icons.help_outline, color: Color(0xFFEAB308)),
                SizedBox(width: 10),
                Text('Bienvenido a FashionStore', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 12),
            const Text(
              '• Explora el catálogo de moda y pruébate prendas en Realidad Aumentada (AR).\n'
              '• Toca la campanita 🔔 para ver tus notificaciones de reservas, ventas y alertas en tiempo real.\n'
              '• Usa el icono 💬 para conversar con el Asistente IA de recomendaciones de estilo.\n'
              '• Abre el menú lateral tocando tu avatar para acceder a todas las funciones.',
              style: TextStyle(color: Colors.white70, fontSize: 13, height: 1.5),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFEAB308),
                  foregroundColor: Colors.black,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Entendido', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeroSection() {
    return Container(
      width: double.infinity,
      height: 400,
      decoration: const BoxDecoration(
        image: DecorationImage(
          image: NetworkImage('https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?q=80&w=800&auto=format&fit=crop'),
          fit: BoxFit.cover,
        ),
      ),
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.centerRight,
            end: Alignment.centerLeft,
            colors: [
              const Color(0xFF0D0D10).withValues(alpha: 0.1),
              const Color(0xFF0D0D10).withValues(alpha: 0.9),
            ],
          ),
        ),
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFEAB308).withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(4),
                border: Border.all(color: const Color(0xFFEAB308)),
              ),
              child: const Text('🌟 VESTIDORES VIRTUALES AR & BOUTIQUE', style: TextStyle(color: Color(0xFFEAB308), fontSize: 10, fontWeight: FontWeight.bold)),
            ),
            const SizedBox(height: 16),
            const Text(
              'VISTE LO ESENCIAL.\nDEFINE TU ESTILO.',
              style: TextStyle(
                color: Colors.white,
                fontSize: 32,
                fontWeight: FontWeight.w900,
                height: 1.1,
                fontFamily: 'Serif', // Simula la fuente elegante de la web
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Descubre nuestra nueva colección de alta costura, pruébate las prendas en Realidad Aumentada desde casa y aparta tu vestidor VIP en tienda física.',
              style: TextStyle(color: Colors.white70, fontSize: 14, height: 1.5),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                  ),
                  onPressed: () {},
                  child: const Text('DESCUBRIR COLECCIÓN ↓', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCatalogSection() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('CATÁLOGO OFICIAL 2026', style: TextStyle(color: Color(0xFFEAB308), fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Prendas Esenciales', style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold, fontFamily: 'Serif')),
              TextButton(
                onPressed: () {
                  Navigator.push(context, MaterialPageRoute(builder: (context) => const CatalogoScreen()));
                },
                child: const Text('Ver Todo ➔', style: TextStyle(color: Colors.white70)),
              )
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 380, // Altura ajustada para las tarjetas de catálogo
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _buildProductCard(
                  image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400',
                  category: 'CAMISAS Y BLUSAS',
                  title: 'Camisa Oxford Slim Fit',
                  price: 'Bs. 180.00',
                  stock: '705 uds.',
                  colors: [Colors.white, Colors.black, Colors.blue],
                ),
                const SizedBox(width: 16),
                _buildProductCard(
                  image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?q=80&w=400&auto=format&fit=crop',
                  category: 'VESTIDOS',
                  title: 'Vestido Elegante de Gala',
                  price: 'Bs. 420.00',
                  stock: '203 uds.',
                  colors: [Colors.black, Colors.red, Colors.green],
                ),
                const SizedBox(width: 16),
                _buildProductCard(
                  image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=400&auto=format&fit=crop',
                  category: 'ABRIGOS Y CHAQUETAS',
                  title: 'Chaqueta Cuero Biker',
                  price: 'Bs. 390.00',
                  stock: '125 uds.',
                  colors: [Colors.black, Colors.brown],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProductCard({
    required String image,
    required String category,
    required String title,
    required String price,
    required String stock,
    required List<Color> colors,
  }) {
    return Container(
      width: 260,
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1F),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF2A2A35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Imagen y Badges
          Stack(
            children: [
              ClipRRect(
                borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                child: Image.network(
                  image, 
                  height: 200, 
                  width: double.infinity, 
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) => Container(
                    height: 200,
                    width: double.infinity,
                    color: Colors.grey[900],
                    child: const Icon(Icons.broken_image, color: Colors.grey, size: 50),
                  ),
                ),
              ),
              Positioned(
                top: 12,
                left: 12,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFF8B5CF6), // Morado AR
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.view_in_ar, color: Colors.white, size: 12),
                      SizedBox(width: 4),
                      Text('AR VESTIDOR', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
              ),
              Positioned(
                bottom: 12,
                left: 12,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.7),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.inventory_2, color: Color(0xFFEAB308), size: 12),
                      const SizedBox(width: 4),
                      Text('Stock total: $stock', style: const TextStyle(color: Colors.white, fontSize: 10)),
                    ],
                  ),
                ),
              ),
            ],
          ),
          // Info del producto
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(category, style: const TextStyle(color: Colors.grey, fontSize: 10, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Text(
                  title,
                  style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold, fontFamily: 'Serif'),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 12),
                Row(
                  children: colors.map((c) => Container(
                    margin: const EdgeInsets.only(right: 6),
                    width: 12,
                    height: 12,
                    decoration: BoxDecoration(
                      color: c,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.grey.withValues(alpha: 0.5)),
                    ),
                  )).toList(),
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(price, style: const TextStyle(color: Color(0xFFEAB308), fontSize: 18, fontWeight: FontWeight.bold)),
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: const BoxDecoration(
                        color: Color(0xFF0D0D10),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.arrow_forward, color: Colors.white, size: 16),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
