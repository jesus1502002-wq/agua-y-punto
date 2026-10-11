import React, { useState, useEffect } from 'react';
import { 
  Droplet, ShoppingBag, Truck, CreditCard,
  Plus, Minus, Check, Upload, Clock,
  ArrowRight, Store, Award, MessageCircle,
  Lock, Power, AlertTriangle, ShieldCheck, User, Phone, Trash2, ExternalLink, RefreshCw
} from 'lucide-react';
import { supabase } from './supabaseClient';

export default function App() {
  const [activeTab, setActiveTab] = useState('order');
  const [quantity, setQuantity] = useState(2);
  const [deliveryType, setDeliveryType] = useState('delivery');
  const [proofFile, setProofFile] = useState(null);
  const [proofUploaded, setProofUploaded] = useState(false);
  const [orderStatus, setOrderStatus] = useState('idle');
  const [stamps, setStamps] = useState(6);
  
  // Tasa del dólar BCV
  const [bcvRate, setBcvRate] = useState(null);
  const [loadingBcv, setLoadingBcv] = useState(true);

  // Datos del cliente
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');

  // Estado de administración y negocio
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  
  // Configuración del negocio
  const [isOpen, setIsOpen] = useState(true);
  const [hasStock, setHasStock] = useState(true);

  // Lista de pedidos
  const [adminOrders, setAdminOrders] = useState([]);

  // Precios
  const PRICE_PER_BOTTLE = 0.50; 
  const DELIVERY_FEE = deliveryType === 'delivery' ? 0.30 : 0.00;

  // Lógica de botellón gratis
  const isRewardEligible = (stamps + quantity) >= 10;
  const billableQuantity = isRewardEligible ? Math.max(0, quantity - 1) : quantity;

  const subtotal = billableQuantity * PRICE_PER_BOTTLE;
  const totalUSD = subtotal + DELIVERY_FEE;
  const totalBs = bcvRate ? (totalUSD * bcvRate) : 0;

  // Clave Administrador
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || "adminRolmax.15";

  // Datos Pago Móvil
  const PAGO_MOVIL_BANCO = "Bancamiga";
  const PAGO_MOVIL_CI = "V-28442395";
  const PAGO_MOVIL_TEL = "04243353961";

  useEffect(() => {
    fetchBcvRate();
  }, []);

  const fetchBcvRate = async () => {
    setLoadingBcv(true);
    try {
      const response = await fetch('https://rates.dolarvzla.com/bcv/current.json');
      const data = await response.json();
      if (data && data.current && data.current.usd) {
        setBcvRate(data.current.usd);
      } else {
        setBcvRate(36.50);
      }
    } catch (error) {
      console.error('Error al obtener la tasa BCV:', error);
      setBcvRate(36.50);
    } finally {
      setLoadingBcv(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchOrders();
    }
  }, [isAdmin]);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*');

      if (error) throw error;
      if (data) setAdminOrders(data);
    } catch (error) {
      console.error('Error al cargar pedidos:', error.message);
    }
  };

  const handleDeleteOrder = async (order) => {
    const confirmDelete = window.confirm(`¿Confirmas que el pedido de "${order.client_name}" ya fue entregado y deseas eliminarlo?`);
    if (!confirmDelete) return;

    try {
      let query = supabase.from('orders').delete();

      if (order.id) {
        query = query.eq('id', order.id);
      } else if (order.client_phone) {
        query = query.eq('client_phone', order.client_phone);
      } else {
        query = query.eq('client_name', order.client_name);
      }

      const { error } = await query;
      if (error) throw error;

      setAdminOrders(prev => prev.filter(item => {
        if (order.id) return item.id !== order.id;
        return item.client_phone !== order.client_phone || item.client_name !== order.client_name;
      }));

    } catch (error) {
      console.error('Error al eliminar el pedido:', error.message);
      alert('No se pudo eliminar el pedido. Inténtalo nuevamente.');
    }
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminPasswordInput === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setShowPasswordModal(false);
      setAdminPasswordInput('');
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  const handleUploadProof = (e) => {
    if (e.target.files && e.target.files[0]) {
      setProofFile(e.target.files[0]);
      setProofUploaded(true);
    }
  };

  const isFormValid = clientPhone.trim().length >= 10 && isOpen && hasStock;

  const handleSendOrder = async () => {
    if (!isFormValid) return;

    setOrderStatus('processing');

    try {
      let publicProofUrl = null;

      if (proofFile) {
        const fileExt = proofFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `pago_movil/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('comprobantes')
          .upload(filePath, proofFile);

        if (uploadError) {
          console.error('Error al subir comprobante:', uploadError.message);
        } else {
          const { data: urlData } = supabase.storage
            .from('comprobantes')
            .getPublicUrl(filePath);

          publicProofUrl = urlData.publicUrl;
        }
      }

      const newOrder = {
        client_name: clientName || 'Cliente Agua y Punto',
        client_phone: clientPhone,
        quantity: quantity,
        delivery_type: deliveryType === 'delivery' ? 'Delivery a Domicilio' : 'Retiro en Local',
        client_address: clientAddress || 'Retiro en local',
        total: totalUSD,
        proof_url: publicProofUrl,
        status: 'pending'
      };

      const { error } = await supabase
        .from('orders')
        .insert([newOrder]);

      if (error) throw error;

      setOrderStatus('confirmed');

      setStamps(prev => {
        const totalStamps = prev + quantity;
        if (totalStamps >= 10) {
          alert('🎉 ¡Felicidades! Completaste tu Tarjeta de Fidelidad (10 botellones). Se ha aplicado 1 botellón GRATIS.');
          return totalStamps - 10;
        } else {
          alert('¡Pedido realizado con éxito! 🚚\nEn breve nos pondremos en contacto contigo.');
          return totalStamps;
        }
      });

      setClientName('');
      setClientPhone('');
      setClientAddress('');
      setProofFile(null);
      setProofUploaded(false);

    } catch (error) {
      console.error('Error al procesar el pedido:', error.message);
      alert('Error: ' + (error.message || 'No se pudo guardar el pedido'));
      setOrderStatus('idle');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex justify-center items-start p-0 sm:p-4 font-sans">
      <div className="w-full max-w-md bg-white min-h-screen sm:min-h-[840px] sm:rounded-3xl shadow-2xl flex flex-col justify-between overflow-hidden border border-sky-100 relative">
        
        {/* Cabecera */}
        <header className="p-4 bg-sky-500 sticky top-0 z-20 shadow-md flex justify-between items-center text-white">
          <div className="flex items-center gap-2 mx-auto">
            <Droplet className="w-6 h-6 fill-current text-white" />
            <h1 className="font-extrabold text-xl tracking-wider uppercase">Agua y Punto</h1>
            <Droplet className="w-6 h-6 fill-current text-white" />
          </div>
          
          {!isAdmin ? (
            <button 
              onClick={() => setShowPasswordModal(true)}
              className="p-1.5 text-sky-100 hover:text-white transition-all rounded-lg absolute right-3"
              title="Acceso Administración"
            >
              <Lock className="w-4 h-4" />
            </button>
          ) : (
            <button 
              onClick={() => setIsAdmin(false)}
              className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white text-sky-600 hover:bg-sky-50 transition-all absolute right-3"
            >
              Salir
            </button>
          )}
        </header>

        {/* Modal Contraseña */}
        {showPasswordModal && (
          <div className="absolute inset-0 bg-sky-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white p-5 rounded-2xl w-full max-w-xs space-y-4 shadow-2xl border border-sky-100">
              <div className="flex items-center gap-2 text-sky-600">
                <Lock className="w-5 h-5" />
                <h3 className="font-bold text-sm">Acceso Privado Dueño</h3>
              </div>
              <form onSubmit={handleAdminLogin} className="space-y-3">
                <div>
                  <input 
                    type="password" 
                    placeholder="Ingresa la contraseña" 
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                  {passwordError && (
                    <p className="text-[10px] text-rose-500 mt-1">Contraseña incorrecta</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button 
                    type="submit" 
                    className="flex-1 py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl transition-all"
                  >
                    Entrar
                  </button>
                  <button 
                    type="button" 
                    onClick={() => { setShowPasswordModal(false); setPasswordError(false); }}
                    className="px-3 py-2 bg-slate-100 text-slate-500 text-xs rounded-xl hover:bg-slate-200"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Contenido Principal */}
        <main className="flex-1 p-4 overflow-y-auto space-y-4 pb-24 bg-slate-50">
          {!isAdmin ? (
            activeTab === 'order' ? (
              <>
                {/* Banner Tasa BCV */}
                <div className="bg-sky-500 text-slate-900 p-3 rounded-2xl flex justify-between items-center text-xs shadow-sm font-semibold">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
                    <span className="font-bold text-slate-900">Tasa Oficial BCV:</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono font-extrabold text-slate-900">
                    {loadingBcv ? (
                      <span className="text-slate-700 text-[10px]">Cargando...</span>
                    ) : (
                      <span>Bs. {bcvRate ? bcvRate.toFixed(2) : '0.00'} / USD</span>
                    )}
                    <button onClick={fetchBcvRate} className="text-slate-800 hover:text-black p-1">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Tarjeta Fidelidad */}
                <div className="bg-sky-500 text-slate-900 p-4 rounded-2xl shadow-md space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1 text-slate-900">
                      <Award className="w-4 h-4 text-slate-900" /> Tarjeta de Fidelidad
                    </span>
                    <span className="text-xs bg-slate-900 text-white px-2 py-0.5 rounded-full font-bold">{stamps}/10</span>
                  </div>
                  <div className="grid grid-cols-10 gap-1.5 my-2">
                    {[...Array(10)].map((_, i) => (
                      <div 
                        key={i} 
                        className={`h-6 rounded-md flex items-center justify-center text-xs font-black ${
                          i < stamps 
                            ? 'bg-slate-900 text-white shadow-sm' 
                            : 'bg-white/40 text-slate-900 border border-slate-900/20'
                        }`}
                      >
                        {i < stamps ? '✓' : i + 1}
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] font-bold text-slate-900">¡Llega a 10 sellos y tu siguiente recarga es gratis!</p>
                </div>

                {/* Datos del Cliente */}
                <div className="bg-sky-500 text-slate-900 p-4 rounded-2xl shadow-md space-y-3">
                  <h2 className="text-sm font-extrabold text-slate-900">Tus Datos de Contacto</h2>
                  <div>
                    <label className="text-[11px] font-bold text-slate-900 block mb-1">Nombre completo:</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                      <input 
                        disabled={!isOpen || !hasStock}
                        type="text" 
                        placeholder="Ej: Jesus Centeno"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        className="w-full bg-white text-slate-900 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-900 block mb-1">Número de WhatsApp (Obligatorio):</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                      <input 
                        disabled={!isOpen || !hasStock}
                        type="tel" 
                        placeholder="Ej: 04121234567"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        className="w-full bg-white text-slate-900 rounded-xl pl-9 pr-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Selección de Cantidad */}
                <div className="bg-sky-500 text-slate-900 p-4 rounded-2xl shadow-md space-y-3">
                  <h2 className="text-sm font-extrabold text-slate-900">¿Cuántos botellones vas a recargar?</h2>
                  <div className="flex items-center justify-between bg-white/20 p-2 rounded-xl backdrop-blur-sm border border-slate-900/10">
                    <button 
                      disabled={!isOpen || !hasStock}
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-10 h-10 rounded-lg bg-slate-900 text-white font-bold text-lg hover:bg-black transition-all flex items-center justify-center"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <div className="text-center">
                      <span className="text-2xl font-black text-slate-900">{quantity}</span>
                      <span className="text-xs text-slate-900 font-bold block">Botellón{quantity > 1 ? 'es' : ''} (20L)</span>
                    </div>
                    <button 
                      disabled={!isOpen || !hasStock}
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-10 h-10 rounded-lg bg-slate-900 text-white font-bold text-lg hover:bg-black transition-all flex items-center justify-center"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Tipo de Entrega */}
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    disabled={!isOpen || !hasStock}
                    onClick={() => setDeliveryType('delivery')}
                    className={`p-3 rounded-2xl shadow-md text-left flex items-center gap-3 transition-all ${
                      deliveryType === 'delivery'
                        ? 'bg-sky-500 text-slate-900 border-2 border-slate-900'
                        : 'bg-white text-slate-700 hover:bg-sky-50'
                    }`}
                  >
                    <Truck className="w-5 h-5 text-slate-900" />
                    <div>
                      <div className="text-xs font-black text-slate-900">Delivery</div>
                      <div className="text-[10px] font-bold text-slate-800">+\$0.30 envío</div>
                    </div>
                  </button>

                  <button 
                    disabled={!isOpen || !hasStock}
                    onClick={() => setDeliveryType('pickup')}
                    className={`p-3 rounded-2xl shadow-md text-left flex items-center gap-3 transition-all ${
                      deliveryType === 'pickup'
                        ? 'bg-sky-500 text-slate-900 border-2 border-slate-900'
                        : 'bg-white text-slate-700 hover:bg-sky-50'
                    }`}
                  >
                    <Store className="w-5 h-5 text-slate-900" />
                    <div>
                      <div className="text-xs font-black text-slate-900">Retiro Local</div>
                      <div className="text-[10px] font-bold text-slate-800">Sin envío</div>
                    </div>
                  </button>
                </div>

                {deliveryType === 'delivery' && (
                  <div className="bg-sky-500 text-slate-900 p-3 rounded-2xl shadow-md">
                    <label className="text-xs block mb-1 font-bold text-slate-900">Dirección de entrega:</label>
                    <input 
                      disabled={!isOpen || !hasStock}
                      type="text" 
                      placeholder="Ej: Sector Centro, Casa #45..."
                      value={clientAddress}
                      onChange={(e) => setClientAddress(e.target.value)}
                      className="w-full bg-white text-slate-900 font-semibold rounded-xl px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>
                )}

                {/* Pago Móvil y Comprobante */}
                <div className="bg-sky-500 text-slate-900 p-4 rounded-2xl shadow-md space-y-3">
                  <h2 className="text-sm font-extrabold text-slate-900">Datos Pago Móvil</h2>
                  
                  <div className="bg-white/20 p-3 rounded-xl text-xs space-y-1 font-bold text-slate-900">
                    <div className="flex justify-between">
                      <span>Banco: <strong>{PAGO_MOVIL_BANCO}</strong></span>
                      <span className="font-mono font-black">{PAGO_MOVIL_TEL}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>C.I. / RIF: <strong>{PAGO_MOVIL_CI}</strong></span>
                      <span>Agua y Punto</span>
                    </div>
                  </div>

                  <label className="border-2 border-dashed border-slate-900/40 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-white/20 transition-all text-slate-900">
                    <Upload className="w-6 h-6 text-slate-900 mb-1" />
                    <span className="text-xs font-black">
                      {proofUploaded ? "✓ Comprobante cargado" : "Cargar Comprobante de Pago"}
                    </span>
                    <input 
                      disabled={!isOpen || !hasStock}
                      type="file" 
                      accept="image/*" 
                      onChange={handleUploadProof} 
                      className="hidden" 
                    />
                  </label>
                </div>

                {/* Resumen Final */}
                <div className="bg-sky-500 text-slate-900 p-4 rounded-2xl shadow-md space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-900">
                    <span>
                      {quantity} Recargas (\${PRICE_PER_BOTTLE.toFixed(2)} c/u)
                      {isRewardEligible && <span className="font-black ml-1 text-slate-900 underline">(-1 GRATIS 🎉)</span>}
                    </span>
                    <span>\${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-slate-900">
                    <span>Costo de envío</span>
                    <span>\${DELIVERY_FEE.toFixed(2)}</span>
                  </div>

                  <div className="border-t border-slate-900/20 pt-2 space-y-1">
                    <div className="flex justify-between text-sm font-black text-slate-900">
                      <span>Total en Dólares (\$USD):</span>
                      <span>\${totalUSD.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold bg-slate-900 text-white p-2 rounded-xl">
                      <span>Total en Bolívares (Bs):</span>
                      <span className="font-mono text-sm font-black">Bs. {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

                <button 
                  disabled={!isFormValid || orderStatus === 'processing'}
                  onClick={handleSendOrder}
                  className={`w-full py-3.5 rounded-2xl font-black text-sm transition-all shadow-lg flex items-center justify-center gap-2 ${
                    isFormValid
                      ? 'bg-slate-900 hover:bg-black text-white active:scale-[0.98]' 
                      : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {orderStatus === 'processing' ? (
                    <span>Registrando pedido...</span>
                  ) : (
                    <>
                      <span>Enviar Pedido Directo</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </>
            ) : (
              <div className="space-y-4">
                <h2 className="text-sm font-bold text-slate-800">Seguimiento de tu Pedido</h2>
                {orderStatus === 'confirmed' ? (
                  <div className="bg-sky-500 text-slate-900 rounded-2xl p-5 text-center space-y-4 shadow-md font-bold">
                    <Truck className="w-8 h-8 animate-bounce mx-auto text-slate-900" />
                    <div>
                      <h3 className="font-extrabold text-base">¡Pedido recibido con éxito!</h3>
                      <p className="text-xs text-slate-900 mt-1">Tu pedido ya está en nuestro sistema.</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl p-8 text-center text-slate-500 text-xs shadow-sm font-semibold">
                    No tienes pedidos activos en este momento.
                  </div>
                )}
              </div>
            )
          ) : (
            /* VISTA DUEÑO */
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-sky-600" /> Panel Modo Dueño
                </h2>
                <button 
                  onClick={fetchOrders}
                  className="px-2 py-1 bg-slate-900 text-white text-[10px] rounded-lg font-bold"
                >
                  Actualizar 🔄
                </button>
              </div>

              {/* Pedidos Recibidos */}
              <div className="space-y-3">
                {adminOrders.length === 0 ? (
                  <div className="bg-white rounded-2xl p-6 text-center text-slate-500 text-xs shadow-sm font-semibold">
                    No hay pedidos pendientes.
                  </div>
                ) : (
                  adminOrders.map((order, idx) => {
                    const orderTotalBs = bcvRate ? (Number(order.total) * bcvRate) : 0;

                    return (
                      <div key={order.id || idx} className="bg-sky-500 text-slate-900 rounded-2xl p-4 space-y-3 text-xs shadow-md font-bold">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-black text-sm">{order.client_name}</span>
                            <p className="text-slate-900 font-mono">WhatsApp: {order.client_phone}</p>
                          </div>
                          <div className="text-right bg-slate-900 text-white px-2 py-1 rounded-lg">
                            <span className="font-bold block">\${order.total ? Number(order.total).toFixed(2) : '0.00'}</span>
                            <span className="text-[10px] font-mono">Bs. {orderTotalBs.toFixed(2)}</span>
                          </div>
                        </div>
                        
                        <div className="bg-white/30 p-2.5 rounded-xl space-y-1 text-slate-900">
                          <p>📦 <strong>Cantidad:</strong> {order.quantity} Botellones</p>
                          <p>🚚 <strong>Tipo:</strong> {order.delivery_type}</p>
                          <p>📍 <strong>Dirección:</strong> {order.client_address}</p>
                          
                          {order.proof_url && (
                            <div className="pt-1">
                              <a 
                                href={order.proof_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 text-white rounded-lg text-[10px] font-bold"
                              >
                                <ExternalLink className="w-3 h-3" /> Ver Comprobante
                              </a>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <a 
                            href={`https://wa.me/58${order.client_phone ? order.client_phone.replace(/^0/, '') : ''}?text=Hola%20${order.client_name},%20recibimos%20tu%20pedido%20en%20Agua%20y%20Punto.%20Monto:%20$${Number(order.total).toFixed(2)}%20(Bs.%20${orderTotalBs.toFixed(2)}).`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-2 bg-slate-900 text-white font-bold text-center rounded-xl flex items-center justify-center gap-1"
                          >
                            <MessageCircle className="w-4 h-4 fill-current" />
                            <span>Escribir</span>
                          </a>

                          <button 
                            onClick={() => handleDeleteOrder(order)}
                            className="px-3 py-2 bg-rose-600 text-white font-bold rounded-xl flex items-center justify-center gap-1"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Entregado</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </main>

        {/* Menú Inferior */}
        {!isAdmin && (
          <nav className="bg-sky-500 border-t border-sky-400 p-2 flex justify-around text-slate-900 font-bold">
            <button 
              onClick={() => setActiveTab('order')}
              className={`flex flex-col items-center gap-0.5 p-1 rounded-xl transition-all ${
                activeTab === 'order' ? 'text-slate-900 font-black' : 'text-slate-800 opacity-70'
              }`}
            >
              <ShoppingBag className="w-5 h-5" />
              <span className="text-[10px]">Pedir Agua</span>
            </button>

            <button 
              onClick={() => setActiveTab('status')}
              className={`flex flex-col items-center gap-0.5 p-1 rounded-xl transition-all ${
                activeTab === 'status' ? 'text-slate-900 font-black' : 'text-slate-800 opacity-70'
              }`}
            >
              <Truck className="w-5 h-5" />
              <span className="text-[10px]">Estado</span>
            </button>
          </nav>
        )}

      </div>
    </div>
  );
}