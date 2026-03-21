import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  MapPin, Plus, Truck, Clock, Phone, User, Calendar, Weight,
  CheckCircle, LogIn, Users, Settings, Navigation, Bell, AlertCircle,
  ChevronRight, Activity, Package, Flag, Loader, Wand2, X, ChevronDown, ChevronUp,
  Building2, Upload, Edit2, Trash2, Wrench, Copy, FileText, History, Search,
  Paperclip, Mail, Printer, Download
} from 'lucide-react';

// ─── API upload helper (for multipart/form-data) ─────────────────────────────

async function apiUpload(path, formData) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, { method: 'POST', headers, body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
  return data;
}

// ─── API helpers ─────────────────────────────────────────────────────────────

const API_BASE = '/api';

function getToken() { return localStorage.getItem('ft_token'); }
function setToken(token) {
  if (token) localStorage.setItem('ft_token', token);
  else localStorage.removeItem('ft_token');
}

async function openAuthPdf(path) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, { headers });
  if (!res.ok) { alert('Could not load PDF: ' + res.status); return; }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  // Use <a> click instead of window.open — avoids mobile Safari popup blocking
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

async function apiRequest(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
  return data;
}

// ─── Cost calculation (no destination fee) ───────────────────────────────────

const calculateDetailedCost = (pickupType, weight, miles) => {
  const pickupFee = pickupType === 'Residential' ? 225
    : pickupType === 'Funeral Home/Care Center' ? 175 : 195;

  const mileageFee = miles > 30 ? (miles - 30) * 3.50 : 0;

  let obFee = 0;
  if (weight > 250) {
    obFee = 50 + Math.floor((weight - 250) / 100) * 50;
  }

  const adminFee = 10;
  const totalCost = pickupFee + mileageFee + obFee + adminFee;
  return { pickupFee, mileageFee, obFee, adminFee, totalCost };
};

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_ORDER = ['Pending', 'Accepted', 'En Route', 'Arrived', 'Loaded', 'Completed'];

const NEXT_STATUS = {
  'Pending':  'Accepted',
  'Accepted': 'En Route',
  'En Route': 'Arrived',
  'Arrived':  'Loaded',
  'Loaded':   'Completed',
};

const STATUS_COLORS = {
  'Pending':   'bg-yellow-100 text-yellow-800 border-yellow-300',
  'Accepted':  'bg-blue-100 text-blue-800 border-blue-300',
  'En Route':  'bg-indigo-100 text-indigo-800 border-indigo-300',
  'Arrived':   'bg-orange-100 text-orange-800 border-orange-300',
  'Loaded':    'bg-purple-100 text-purple-800 border-purple-300',
  'Completed': 'bg-green-100 text-green-800 border-green-300',
  'Cancelled': 'bg-red-100 text-red-800 border-red-300',
};

const STATUS_DOT = {
  'Pending':   'bg-yellow-400',
  'Accepted':  'bg-blue-500',
  'En Route':  'bg-indigo-500',
  'Arrived':   'bg-orange-500',
  'Loaded':    'bg-purple-500',
  'Completed': 'bg-green-500',
  'Cancelled': 'bg-red-400',
};

const NEXT_BUTTON_LABEL = {
  'Pending':  'Accept Transport',
  'Accepted': 'Mark En Route',
  'En Route': 'Mark Arrived',
  'Arrived':  'Mark Loaded',
  'Loaded':   'Complete Transport',
};

const NEXT_BUTTON_COLOR = {
  'Pending':  'bg-blue-600 hover:bg-blue-700',
  'Accepted': 'bg-indigo-600 hover:bg-indigo-700',
  'En Route': 'bg-orange-600 hover:bg-orange-700',
  'Arrived':  'bg-purple-600 hover:bg-purple-700',
  'Loaded':   'bg-green-600 hover:bg-green-700',
};

function timeSince(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatTime(isoString) {
  if (!isoString) return null;
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-700 border-gray-300'}`}>
    {status}
  </span>
);

const StatusTimeline = ({ transport }) => {
  const timestamps = {
    'Pending':   transport.createdAt,
    'Accepted':  transport.acceptedAt,
    'En Route':  transport.enRouteAt,
    'Arrived':   transport.arrivedAt,
    'Loaded':    transport.loadedAt,
    'Completed': transport.completedAt,
  };
  const currentIdx = STATUS_ORDER.indexOf(transport.status);

  return (
    <div className="flex items-center gap-1 flex-wrap mt-2">
      {STATUS_ORDER.map((s, i) => {
        const done = i <= currentIdx;
        const ts = timestamps[s];
        return (
          <React.Fragment key={s}>
            <div className="flex flex-col items-center">
              <div className={`w-3 h-3 rounded-full border-2 ${done ? `${STATUS_DOT[s]} border-transparent` : 'bg-white border-gray-300'}`} />
              <span className={`text-xs mt-0.5 ${done ? 'text-gray-700 font-medium' : 'text-gray-400'}`} style={{ fontSize: '9px' }}>
                {s}
              </span>
              {ts && done && (
                <span className="text-gray-400" style={{ fontSize: '9px' }}>{formatTime(ts)}</span>
              )}
            </div>
            {i < STATUS_ORDER.length - 1 && (
              <div className={`h-0.5 w-4 mb-4 ${i < currentIdx ? 'bg-gray-400' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// Alert banner for funeral home status notifications
const AlertBanners = ({ alerts, onDismiss }) => {
  if (!alerts.length) return null;
  return (
    <div className="space-y-2 mb-4">
      {alerts.map(alert => (
        <div key={alert.id} className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <Bell className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-blue-900">{alert.message}</p>
            {alert.decedent_name && (
              <p className="text-xs text-blue-600 mt-0.5">Transport: {alert.decedent_name}</p>
            )}
          </div>
          <button
            onClick={() => onDismiss(alert.id)}
            className="text-blue-400 hover:text-blue-600 text-lg leading-none flex-shrink-0"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

// Driver action button to advance to next status
const AdvanceStatusButton = ({ transport, onAdvance, loading, etaValue, onEtaChange }) => {
  const next = NEXT_STATUS[transport.status];
  if (!next) return null;

  return (
    <div className="mt-3 pt-3 border-t space-y-2">
      {transport.status === 'Accepted' && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">ETA to Pickup (optional)</label>
          <input
            type="text"
            value={etaValue || ''}
            onChange={(e) => onEtaChange(e.target.value)}
            className="w-full text-sm p-1.5 border border-gray-300 rounded"
            placeholder="e.g. 15 minutes, 2:30 PM"
          />
        </div>
      )}
      <button
        onClick={() => onAdvance(transport.id, next, etaValue)}
        disabled={loading}
        className={`w-full text-white py-2 px-4 rounded-lg font-medium text-sm disabled:opacity-50 ${NEXT_BUTTON_COLOR[transport.status]}`}
      >
        {loading ? <Loader className="w-4 h-4 inline mr-1 animate-spin" /> : null}
        {NEXT_BUTTON_LABEL[transport.status]}
      </button>
    </div>
  );
};

// Dispatch board card
const DispatchCard = ({ transport, userRole, onAdvance, loading, etaValues, setEtaValue, onAssign, drivers, vehicles, onEdit, currentUser, onCancelRequest }) => {
  const [showAssign, setShowAssign] = useState(false);
  const [selDriver, setSelDriver] = useState(transport.assignedDriverId || '');
  const [selVehicle, setSelVehicle] = useState(transport.assignedVehicleId || '');
  const [dispatchAttachments, setDispatchAttachments] = useState(null);
  const [dispatchAttachLoading, setDispatchAttachLoading] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [dispatchEmailForms, setDispatchEmailForms] = useState({});
  const dispatchFileRef = React.useRef(null);

  const loadDispatchAttachments = async () => {
    if (dispatchAttachLoading) return;
    setDispatchAttachLoading(true);
    try {
      const data = await apiRequest('GET', `/transports/${transport.id}/attachments`);
      setDispatchAttachments(data.attachments || []);
    } catch(_) { setDispatchAttachments([]); }
    finally { setDispatchAttachLoading(false); }
  };

  const handleDispatchUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    for (const file of files) {
      const fd = new FormData();
      fd.append('file', file);
      try { await apiUpload(`/transports/${transport.id}/attachments`, fd); } catch(_) {}
    }
    await loadDispatchAttachments();
    e.target.value = '';
  };

  const toggleAttach = () => {
    if (!showAttach && dispatchAttachments === null) loadDispatchAttachments();
    setShowAttach(p => !p);
  };

  const availableDrivers = (drivers || []).filter(d => d.status === 'Available' || d.id === transport.assignedDriverId);
  const availableVehicles = (vehicles || []).filter(v => v.status === 'Available' || v.id === transport.assignedVehicleId);

  return (
    <div className={`bg-white rounded-lg shadow-sm border-l-4 p-3 ${
      transport.status === 'Pending' ? 'border-yellow-400' :
      transport.status === 'Accepted' ? 'border-blue-400' :
      transport.status === 'En Route' ? 'border-indigo-400' :
      transport.status === 'Arrived' ? 'border-orange-400' :
      transport.status === 'Loaded' ? 'border-purple-400' :
      transport.status === 'Cancelled' ? 'border-red-400' :
      'border-green-400'
    }`}>
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-gray-400">#{transport.id}</span>
            <StatusBadge status={transport.status} />
            {transport.scheduledPickupAt && (
              <span className="text-xs text-indigo-600 font-medium">⏰ {new Date(transport.scheduledPickupAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            )}
          </div>
          <p className="font-semibold text-gray-900 truncate">{transport.decedentName || '—'}</p>
          <p className="text-xs text-gray-500">{transport.funeralHomeName}</p>
        </div>
        <div className="text-right text-xs text-gray-500 flex-shrink-0 flex flex-col items-end gap-1">
          <div>{timeSince(transport.createdAt)}</div>
          {transport.assignedDriver && (
            <div className="text-blue-600 font-medium">{transport.assignedDriver}</div>
          )}
          {userRole === 'admin' && (
            <button
              onClick={() => onEdit?.(transport)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 border border-gray-200 hover:border-blue-300 rounded px-1.5 py-0.5"
              title="Edit transport"
            >
              <Edit2 className="w-3 h-3" />✏️ Edit
            </button>
          )}
        </div>
      </div>
      <div className="mt-2 text-xs text-gray-600 space-y-0.5">
        <div className="flex items-center gap-1">
          <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
          <span className="truncate">{transport.pickupLocation} → {transport.destination}</span>
        </div>
        {transport.eta && (
          <div className="flex items-center gap-1 text-indigo-600">
            <Clock className="w-3 h-3" />
            <span>ETA: {transport.eta}</span>
          </div>
        )}
        {transport.notes && (
          <div className="text-gray-500 italic truncate">Note: {transport.notes}</div>
        )}
        {(transport.odometerStart || transport.odometerEnd) && (
          <div className="text-gray-400 text-xs">
            🔢 {transport.odometerStart ? transport.odometerStart.toLocaleString() : '?'} mi
            {transport.odometerEnd ? ` → ${transport.odometerEnd.toLocaleString()} mi` : ''}
          </div>
        )}
      </div>

      {/* Admin: inline driver/vehicle assignment */}
      {userRole === 'admin' && transport.status !== 'Completed' && (
        <div className="mt-2 pt-2 border-t">
          <button
            onClick={() => setShowAssign(s => !s)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            {transport.assignedDriver
              ? <><Truck className="w-3 h-3" />{transport.assignedDriver} · {transport.assignedVehicle || 'no vehicle'}</>
              : <><Users className="w-3 h-3" />Assign Driver & Vehicle</>
            }
            {showAssign ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showAssign && (
            <div className="mt-2 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="text-xs p-1.5 border border-gray-300 rounded w-full"
                  value={selDriver}
                  onChange={e => setSelDriver(e.target.value)}
                >
                  <option value="">— Driver —</option>
                  {availableDrivers.map(d => (
                    <option key={d.id} value={d.id}>{d.name}{d.id === transport.assignedDriverId ? ' ✓' : ''}</option>
                  ))}
                </select>
                <select
                  className="text-xs p-1.5 border border-gray-300 rounded w-full"
                  value={selVehicle}
                  onChange={e => setSelVehicle(e.target.value)}
                >
                  <option value="">— Vehicle —</option>
                  {availableVehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.name}{v.id === transport.assignedVehicleId ? ' ✓' : ''}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => { onAssign(transport.id, selDriver, selVehicle); setShowAssign(false); }}
                disabled={loading || (!selDriver && !selVehicle)}
                className="w-full text-xs bg-blue-600 text-white py-1.5 px-3 rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                Save Assignment
              </button>
            </div>
          )}
        </div>
      )}

      {(() => {
        const isAdmin = userRole === 'admin';
        // Pending calls: any available employee can accept
        const canAcceptPending = userRole === 'employee' && transport.status === 'Pending';
        // After accepted: only the assigned driver or admin can progress
        const isAssignedDriver = userRole === 'employee' &&
          transport.assignedDriverId &&
          String(transport.assignedDriverId) === String(currentUser?.driverId || currentUser?.id);
        const canAdvanceAssigned = (isAdmin || isAssignedDriver) && transport.status !== 'Pending' && transport.status !== 'Completed';
        const canAdvance = isAdmin || canAcceptPending || canAdvanceAssigned;
        if (!canAdvance || transport.status === 'Completed' || transport.status === 'Cancelled') return null;
        return (
          <AdvanceStatusButton
            transport={transport}
            onAdvance={onAdvance}
            loading={loading}
            etaValue={etaValues[transport.id]}
            onEtaChange={(v) => setEtaValue(transport.id, v)}
          />
        );
      })()}

      {userRole === 'admin' && transport.status !== 'Completed' && transport.status !== 'Cancelled' && (
        <button
          onClick={() => onCancelRequest && onCancelRequest(transport.id)}
          className="w-full mt-2 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50"
        >
          Cancel Transport
        </button>
      )}

      {/* Attachments + Summary PDF */}
      {(userRole === 'admin' || userRole === 'employee') && (
        <div className="mt-2 pt-2 border-t border-gray-100 space-y-2">
          {/* Attachment toggle + Summary PDF — spread to opposite sides */}
          <div className="flex items-center justify-between">
            <button onClick={toggleAttach}
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 font-medium">
              <Paperclip className="w-3 h-3" />
              Attachments {dispatchAttachments ? `(${dispatchAttachments.length})` : ''}
            </button>
            <button onClick={() => openAuthPdf(`/transports/${transport.id}/summary.pdf`)}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600">
              <FileText className="w-3 h-3" />📄 Summary PDF
            </button>
          </div>
          {showAttach && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <button onClick={() => dispatchFileRef.current?.click()}
                  className="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-2 py-1 rounded hover:bg-blue-100 flex items-center gap-1">
                  <Paperclip className="w-3 h-3" /> Upload Doc
                </button>
                <input ref={dispatchFileRef} type="file" multiple className="hidden" onChange={handleDispatchUpload} />
              </div>
              {dispatchAttachLoading && <p className="text-xs text-gray-400">Loading...</p>}
              {dispatchAttachments && dispatchAttachments.length === 0 && <p className="text-xs text-gray-400 italic">No documents attached</p>}
              {dispatchAttachments && dispatchAttachments.map(att => (
                <div key={att.id} className="flex items-center justify-between bg-gray-50 rounded px-2 py-1 text-xs">
                  <span className="truncate text-gray-700 flex-1 mr-2">{att.original_name}</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openAuthPdf(`/transports/${transport.id}/attachments/${att.id}/download`)}
                      title="Download" className="p-1 text-gray-400 hover:text-blue-600"><Download className="w-3 h-3" /></button>
                    <button onClick={() => openAuthPdf(`/transports/${transport.id}/attachments/${att.id}/download`)}
                      title="Print" className="p-1 text-gray-400 hover:text-blue-600"><Printer className="w-3 h-3" /></button>
                    <button onClick={() => setDispatchEmailForms(p => ({ ...p, [att.id]: { open: !p[att.id]?.open, to: '', subject: `FCR Doc: ${att.original_name}`, message: '' } }))}
                      title="Email" className="p-1 text-gray-400 hover:text-blue-600"><Mail className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}
              {dispatchAttachments && dispatchAttachments.map(att => dispatchEmailForms[att.id]?.open && (
                <div key={`email-${att.id}`} className="bg-blue-50 border border-blue-200 rounded p-2 space-y-1">
                  <input type="email" placeholder="To email" value={dispatchEmailForms[att.id]?.to || ''}
                    onChange={e => setDispatchEmailForms(p => ({ ...p, [att.id]: { ...p[att.id], to: e.target.value } }))}
                    className="w-full text-xs p-1 border border-gray-300 rounded" />
                  <input type="text" placeholder="Subject" value={dispatchEmailForms[att.id]?.subject || ''}
                    onChange={e => setDispatchEmailForms(p => ({ ...p, [att.id]: { ...p[att.id], subject: e.target.value } }))}
                    className="w-full text-xs p-1 border border-gray-300 rounded" />
                  <textarea placeholder="Message" value={dispatchEmailForms[att.id]?.message || ''}
                    onChange={e => setDispatchEmailForms(p => ({ ...p, [att.id]: { ...p[att.id], message: e.target.value } }))}
                    className="w-full text-xs p-1 border border-gray-300 rounded" rows={2} />
                  <div className="flex gap-1">
                    <button onClick={async () => {
                      const f = dispatchEmailForms[att.id];
                      try { await apiRequest('POST', `/transports/${transport.id}/attachments/${att.id}/email`, { to: f.to, subject: f.subject, message: f.message }); }
                      catch(_) {}
                      setDispatchEmailForms(p => ({ ...p, [att.id]: { ...p[att.id], open: false } }));
                    }} className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">Send</button>
                    <button onClick={() => setDispatchEmailForms(p => ({ ...p, [att.id]: { ...p[att.id], open: false } }))}
                      className="text-xs text-gray-500 px-2 py-1">Cancel</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Per-transport chat */}
      <TransportChat transportId={transport.id} currentUser={currentUser} />
    </div>
  );
};

// ─── Dispatch Board ───────────────────────────────────────────────────────────

const DispatchBoard = ({ transports, userRole, onAdvance, loading, etaValues, setEtaValue, onAssign, drivers, vehicles, onEdit, currentUser, onCancelRequest }) => {
  const now = Date.now();
  const yesterday = now - 24 * 60 * 60 * 1000;

  const groups = {
    'Pending':   transports.filter(t => t.status === 'Pending'),
    'Accepted':  transports.filter(t => t.status === 'Accepted'),
    'En Route':  transports.filter(t => t.status === 'En Route'),
    'Arrived':   transports.filter(t => t.status === 'Arrived'),
    'Loaded':    transports.filter(t => t.status === 'Loaded'),
    'Completed': transports.filter(t => t.status === 'Completed' &&
      new Date(t.completedAt || t.createdAt).getTime() > yesterday),
  };

  const GROUP_HEADERS = {
    'Pending':   { label: 'Pending — Waiting for Driver', icon: Clock, color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
    'Accepted':  { label: 'Accepted — Driver Assigned', icon: User, color: 'text-blue-700 bg-blue-50 border-blue-200' },
    'En Route':  { label: 'En Route — Driving to Pickup', icon: Navigation, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
    'Arrived':   { label: 'Arrived — At Pickup Location', icon: MapPin, color: 'text-orange-700 bg-orange-50 border-orange-200' },
    'Loaded':    { label: 'Loaded — Transport Underway', icon: Package, color: 'text-purple-700 bg-purple-50 border-purple-200' },
    'Completed': { label: 'Completed — Last 24 Hours', icon: CheckCircle, color: 'text-green-700 bg-green-50 border-green-200' },
  };

  return (
    <div className="space-y-4">
      {STATUS_ORDER.map(status => {
        const items = groups[status];
        const { label, icon: Icon, color } = GROUP_HEADERS[status];
        return (
          <div key={status}>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border mb-2 ${color}`}>
              <Icon className="w-4 h-4" />
              <span className="font-semibold text-sm">{label}</span>
              <span className="ml-auto text-sm font-bold">{items.length}</span>
            </div>
            {items.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2">None</p>
            ) : (
              <div className="space-y-2">
                {items.map(t => (
                  <DispatchCard
                    key={t.id}
                    transport={t}
                    userRole={userRole}
                    onAdvance={onAdvance}
                    loading={loading}
                    etaValues={etaValues}
                    setEtaValue={setEtaValue}
                    onAssign={onAssign}
                    drivers={drivers}
                    vehicles={vehicles}
                    onEdit={onEdit}
                    currentUser={currentUser}
                    onCancelRequest={onCancelRequest}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Assignments Tab ──────────────────────────────────────────────────────────

const AssignmentsTab = ({ transports, drivers, vehicles, userRole, onAssign, onAdvance, loading, etaValues, setEtaValue }) => {
  const [selections, setSelections] = useState({});

  const pending = transports.filter(r => r.status === 'Pending');

  const setSelection = (requestId, field, value) => {
    setSelections(prev => ({
      ...prev,
      [requestId]: { ...(prev[requestId] || {}), [field]: value }
    }));
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Pending Assignments</h2>
      {pending.length === 0 ? (
        <div className="text-center py-8">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">No pending assignments</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map((request) => (
            <div key={request.id} className="bg-white rounded-lg shadow-md p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className="text-sm font-mono text-gray-500">#{request.id}</span>
                  <h3 className="font-semibold text-gray-900">{request.decedentName}</h3>
                  <p className="text-sm text-gray-600">{request.funeralHomeName}</p>
                </div>
                <StatusBadge status={request.status} />
              </div>

              <div className="grid grid-cols-1 gap-2 text-sm mb-3">
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-600 truncate">
                    {request.pickupLocation} ({request.pickupLocationType}) → {request.destination}
                  </span>
                </div>
                <div className="flex items-center">
                  <Weight className="w-4 h-4 text-gray-400 mr-2" />
                  <span>{request.weight} lbs • {request.estimatedMiles} miles</span>
                </div>
                {request.notes && (
                  <div className="text-gray-500 text-xs italic">Note: {request.notes}</div>
                )}
              </div>

              {userRole === 'admin' && (
                <div className="border-t pt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Assign Driver</label>
                      <select
                        className="w-full text-sm p-2 border border-gray-300 rounded"
                        value={selections[request.id]?.driverId ?? (request.assignedDriverId || '')}
                        onChange={(e) => setSelection(request.id, 'driverId', e.target.value)}
                      >
                        <option value="">Select Driver</option>
                        {drivers.filter(d => d.status === 'Available' || d.id === request.assignedDriverId).map(driver => (
                          <option key={driver.id} value={driver.id}>{driver.name}{driver.id === request.assignedDriverId ? ' ✓' : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Assign Vehicle</label>
                      <select
                        className="w-full text-sm p-2 border border-gray-300 rounded"
                        value={selections[request.id]?.vehicleId ?? (request.assignedVehicleId || '')}
                        onChange={(e) => setSelection(request.id, 'vehicleId', e.target.value)}
                      >
                        <option value="">Select Vehicle</option>
                        {vehicles.filter(v => v.status === 'Available' || v.id === request.assignedVehicleId).map(vehicle => (
                          <option key={vehicle.id} value={vehicle.id}>{vehicle.name}{vehicle.id === request.assignedVehicleId ? ' ✓' : ''}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const sel = selections[request.id] || {};
                      onAssign(request.id, sel.driverId, sel.vehicleId);
                    }}
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 text-sm"
                  >
                    Assign Driver & Vehicle
                  </button>
                </div>
              )}

              {(userRole === 'employee') && (
                <AdvanceStatusButton
                  transport={request}
                  onAdvance={onAdvance}
                  loading={loading}
                  etaValue={etaValues[request.id]}
                  onEtaChange={(v) => setEtaValue(request.id, v)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Fleet Tab ────────────────────────────────────────────────────────────────

const DRIVER_STATUS_COLORS = {
  'Available': 'bg-green-100 text-green-800',
  'On Call':   'bg-blue-100 text-blue-800',
  'Off Duty':  'bg-gray-100 text-gray-600',
};

const VEHICLE_STATUS_COLORS = {
  'Available':   'bg-green-100 text-green-800',
  'In Use':      'bg-blue-100 text-blue-800',
  'Maintenance': 'bg-yellow-100 text-yellow-800',
};

const EMPTY_DRIVER_FORM = { name: '', status: 'Available', currentLocation: '', phone: '', notes: '' };
const EMPTY_VEHICLE_FORM = { name: '', type: '', status: 'Available', driverId: '', notes: '' };

const MAINTENANCE_TYPES = [
  'Oil Change', 'Tire Rotation', 'New Tires', 'Brake Service', 'Battery Replacement',
  'AC/Heat Service', 'Transmission Service', 'Engine Repair', 'Body Repair',
  'State Inspection', 'Registration Renewal', 'Windshield', 'Other'
];

const EMPTY_MAINTENANCE_FORM = {
  type: 'Oil Change', description: '', cost: '', mileage_at_service: '',
  next_due_mileage: '', next_due_date: '', performed_by: '', notes: '',
  performed_at: new Date().toISOString().split('T')[0],
};

const FleetTab = ({ drivers, vehicles, onRefresh }) => {
  const [fleetSection, setFleetSection] = useState('drivers'); // 'drivers' | 'vehicles' | 'maintenance'

  // Driver state
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);
  const [driverForm, setDriverForm] = useState(EMPTY_DRIVER_FORM);
  const [driverLoading, setDriverLoading] = useState(false);
  const [driverError, setDriverError] = useState('');
  const [driverDeleteId, setDriverDeleteId] = useState(null);

  // Vehicle state
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [vehicleForm, setVehicleForm] = useState(EMPTY_VEHICLE_FORM);
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [vehicleError, setVehicleError] = useState('');
  const [vehicleDeleteId, setVehicleDeleteId] = useState(null);

  // Maintenance state
  const [maintenanceRecords, setMaintenanceRecords] = useState([]);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceError, setMaintenanceError] = useState('');
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [maintenanceForm, setMaintenanceForm] = useState(EMPTY_MAINTENANCE_FORM);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [maintenanceDeleteId, setMaintenanceDeleteId] = useState(null);

  const loadMaintenance = useCallback(async () => {
    setMaintenanceLoading(true);
    try {
      const { maintenance } = await apiRequest('GET', '/vehicles/maintenance/all');
      setMaintenanceRecords(maintenance || []);
    } catch (err) {
      setMaintenanceError(err.message);
    } finally {
      setMaintenanceLoading(false);
    }
  }, []);

  useEffect(() => {
    if (fleetSection === 'maintenance') loadMaintenance();
  }, [fleetSection, loadMaintenance]);

  const handleSaveMaintenance = async () => {
    if (!selectedVehicleId) { setMaintenanceError('Select a vehicle'); return; }
    if (!maintenanceForm.type) { setMaintenanceError('Service type is required'); return; }
    setMaintenanceLoading(true);
    setMaintenanceError('');
    try {
      await apiRequest('POST', `/vehicles/${selectedVehicleId}/maintenance`, {
        ...maintenanceForm,
        cost: parseFloat(maintenanceForm.cost) || 0,
        mileage_at_service: maintenanceForm.mileage_at_service ? parseInt(maintenanceForm.mileage_at_service) : null,
        next_due_mileage: maintenanceForm.next_due_mileage ? parseInt(maintenanceForm.next_due_mileage) : null,
        next_due_date: maintenanceForm.next_due_date || null,
      });
      setShowMaintenanceForm(false);
      setMaintenanceForm(EMPTY_MAINTENANCE_FORM);
      await loadMaintenance();
    } catch (err) {
      setMaintenanceError(err.message);
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const handleDeleteMaintenance = async (vehicleId, recordId) => {
    setMaintenanceLoading(true);
    try {
      await apiRequest('DELETE', `/vehicles/${vehicleId}/maintenance/${recordId}`);
      setMaintenanceDeleteId(null);
      await loadMaintenance();
    } catch (err) {
      setMaintenanceError(err.message);
    } finally {
      setMaintenanceLoading(false);
    }
  };

  // ── Driver handlers ──────────────────────────────────────────────────────

  const openAddDriver = () => {
    setEditingDriver(null);
    setDriverForm(EMPTY_DRIVER_FORM);
    setDriverError('');
    setShowDriverForm(true);
  };

  const openEditDriver = (d) => {
    setEditingDriver(d);
    setDriverForm({ name: d.name, status: d.status, currentLocation: d.currentLocation || '', phone: d.phone || '', notes: d.notes || '' });
    setDriverError('');
    setShowDriverForm(true);
  };

  const handleSaveDriver = async () => {
    if (!driverForm.name.trim()) { setDriverError('Name is required'); return; }
    setDriverLoading(true);
    setDriverError('');
    try {
      if (editingDriver) {
        await apiRequest('PUT', `/drivers/${editingDriver.id}`, {
          name: driverForm.name,
          status: driverForm.status,
          currentLocation: driverForm.currentLocation || null,
          phone: driverForm.phone || null,
          notes: driverForm.notes || null,
        });
      } else {
        await apiRequest('POST', '/drivers', {
          name: driverForm.name,
          status: driverForm.status,
          currentLocation: driverForm.currentLocation || null,
          phone: driverForm.phone || null,
          notes: driverForm.notes || null,
        });
      }
      setShowDriverForm(false);
      setEditingDriver(null);
      onRefresh();
    } catch (err) {
      setDriverError(err.message);
    } finally {
      setDriverLoading(false);
    }
  };

  const handleDeleteDriver = async (id) => {
    setDriverLoading(true);
    try {
      await apiRequest('DELETE', `/drivers/${id}`);
      setDriverDeleteId(null);
      onRefresh();
    } catch (err) {
      setDriverError(err.message);
    } finally {
      setDriverLoading(false);
    }
  };

  // ── Vehicle handlers ─────────────────────────────────────────────────────

  const openAddVehicle = () => {
    setEditingVehicle(null);
    setVehicleForm(EMPTY_VEHICLE_FORM);
    setVehicleError('');
    setShowVehicleForm(true);
  };

  const openEditVehicle = (v) => {
    setEditingVehicle(v);
    setVehicleForm({ name: v.name, type: v.type || '', status: v.status, driverId: v.driverId || '', notes: v.notes || '' });
    setVehicleError('');
    setShowVehicleForm(true);
  };

  const handleSaveVehicle = async () => {
    if (!vehicleForm.name.trim()) { setVehicleError('Unit name is required'); return; }
    setVehicleLoading(true);
    setVehicleError('');
    try {
      if (editingVehicle) {
        await apiRequest('PUT', `/vehicles/${editingVehicle.id}`, {
          name: vehicleForm.name,
          type: vehicleForm.type || null,
          status: vehicleForm.status,
          driverId: vehicleForm.driverId || null,
          notes: vehicleForm.notes || null,
        });
      } else {
        await apiRequest('POST', '/vehicles', {
          name: vehicleForm.name,
          type: vehicleForm.type || null,
          status: vehicleForm.status,
          driverId: vehicleForm.driverId || null,
          notes: vehicleForm.notes || null,
        });
      }
      setShowVehicleForm(false);
      setEditingVehicle(null);
      onRefresh();
    } catch (err) {
      setVehicleError(err.message);
    } finally {
      setVehicleLoading(false);
    }
  };

  const handleDeleteVehicle = async (id) => {
    setVehicleLoading(true);
    try {
      await apiRequest('DELETE', `/vehicles/${id}`);
      setVehicleDeleteId(null);
      onRefresh();
    } catch (err) {
      setVehicleError(err.message);
    } finally {
      setVehicleLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Wrench className="w-5 h-5 text-gray-500" />
        <h2 className="text-lg font-semibold">Fleet Management</h2>
      </div>

      {/* Sub-nav */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => { setFleetSection('drivers'); setShowDriverForm(false); setShowVehicleForm(false); }}
          className={`flex-shrink-0 py-2 px-4 text-sm font-medium border-b-2 -mb-px ${fleetSection === 'drivers' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <User className="w-4 h-4 inline mr-1" />Drivers ({drivers.length})
        </button>
        <button
          onClick={() => { setFleetSection('vehicles'); setShowVehicleForm(false); setShowDriverForm(false); }}
          className={`flex-shrink-0 py-2 px-4 text-sm font-medium border-b-2 -mb-px ${fleetSection === 'vehicles' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <Truck className="w-4 h-4 inline mr-1" />Vehicles ({vehicles.length})
        </button>
        <button
          onClick={() => { setFleetSection('maintenance'); setShowDriverForm(false); setShowVehicleForm(false); setShowMaintenanceForm(false); }}
          className={`flex-shrink-0 py-2 px-4 text-sm font-medium border-b-2 -mb-px ${fleetSection === 'maintenance' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          🔧 Maintenance
        </button>
      </div>

      {/* ── Drivers Section ─────────────────────────────────────────────── */}
      {fleetSection === 'drivers' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={openAddDriver}
              className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium"
            >
              <Plus className="w-4 h-4" /> Add Driver
            </button>
          </div>

          {/* Add/Edit Driver Form */}
          {showDriverForm && (
            <div className="bg-white rounded-lg shadow-md p-4 border border-blue-100">
              <h3 className="font-semibold text-gray-800 mb-3">{editingDriver ? 'Edit Driver' : 'Add Driver'}</h3>
              {driverError && <div className="text-sm text-red-600 bg-red-50 p-2 rounded mb-3">{driverError}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                  <input type="text" value={driverForm.name} onChange={e => setDriverForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="Driver name" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select value={driverForm.status} onChange={e => setDriverForm(p => ({ ...p, status: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded text-sm">
                    <option value="Available">Available</option>
                    <option value="On Call">On Call</option>
                    <option value="Off Duty">Off Duty</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Current Location</label>
                  <input type="text" value={driverForm.currentLocation} onChange={e => setDriverForm(p => ({ ...p, currentLocation: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="City, TX" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                  <input type="tel" value={driverForm.phone} onChange={e => setDriverForm(p => ({ ...p, phone: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="(555) 123-4567" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                  <input type="text" value={driverForm.notes} onChange={e => setDriverForm(p => ({ ...p, notes: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="Optional notes" />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => { setShowDriverForm(false); setEditingDriver(null); setDriverError(''); }}
                  className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={handleSaveDriver} disabled={driverLoading || !driverForm.name.trim()}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {driverLoading ? 'Saving...' : editingDriver ? 'Save Changes' : 'Add Driver'}
                </button>
              </div>
            </div>
          )}

          {/* Delete Confirmation */}
          {driverDeleteId && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800 font-medium mb-3">
                Delete driver "{drivers.find(d => d.id === driverDeleteId)?.name}"? This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setDriverDeleteId(null)}
                  className="flex-1 py-1.5 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={() => handleDeleteDriver(driverDeleteId)} disabled={driverLoading}
                  className="flex-1 py-1.5 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                  {driverLoading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          )}

          {/* Drivers Table */}
          {drivers.length === 0 ? (
            <div className="text-center py-10">
              <User className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No drivers on file. Add one to get started.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left p-3 font-medium text-gray-600">Name</th>
                    <th className="text-left p-3 font-medium text-gray-600">Status</th>
                    <th className="text-left p-3 font-medium text-gray-600 hidden sm:table-cell">Location</th>
                    <th className="text-left p-3 font-medium text-gray-600 hidden sm:table-cell">Phone</th>
                    <th className="p-3 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {drivers.map(d => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="p-3">
                        <div className="font-medium text-gray-900">{d.name}</div>
                        {d.notes && <div className="text-xs text-gray-400 mt-0.5">{d.notes}</div>}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${DRIVER_STATUS_COLORS[d.status] || 'bg-gray-100 text-gray-600'}`}>
                          {d.status}
                        </span>
                      </td>
                      <td className="p-3 text-gray-500 hidden sm:table-cell">{d.currentLocation || '—'}</td>
                      <td className="p-3 text-gray-500 hidden sm:table-cell">{d.phone || '—'}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openEditDriver(d)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => { setDriverDeleteId(d.id); setShowDriverForm(false); }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Maintenance Section ─────────────────────────────────────────── */}
      {fleetSection === 'maintenance' && (() => {
        const filteredRecords = selectedVehicleId
          ? maintenanceRecords.filter(r => r.vehicle_id === selectedVehicleId)
          : maintenanceRecords;

        // Summary stats for selected vehicle
        const now = new Date();
        const thisYear = now.getFullYear();
        const oilChanges = filteredRecords.filter(r => r.type === 'Oil Change').sort((a, b) => new Date(b.performed_at) - new Date(a.performed_at));
        const inspections = filteredRecords.filter(r => r.type === 'State Inspection').sort((a, b) => new Date(b.performed_at) - new Date(a.performed_at));
        const yearCost = filteredRecords
          .filter(r => new Date(r.performed_at).getFullYear() === thisYear)
          .reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);

        const getDueAlert = (record) => {
          if (!record) return null;
          if (record.next_due_date) {
            const due = new Date(record.next_due_date);
            const diff = (due - now) / (1000 * 60 * 60 * 24);
            if (diff < 0) return 'red';
            if (diff <= 30) return 'amber';
          }
          return null;
        };

        return (
          <div className="space-y-4">
            {maintenanceError && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{maintenanceError}</div>}

            {/* Controls row */}
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedVehicleId}
                onChange={e => setSelectedVehicleId(e.target.value)}
                className="p-2 border border-gray-300 rounded text-sm flex-1 min-w-0"
              >
                <option value="">All Vehicles</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              <button
                onClick={() => { setShowMaintenanceForm(true); setMaintenanceForm({ ...EMPTY_MAINTENANCE_FORM, performed_at: new Date().toISOString().split('T')[0] }); if (selectedVehicleId) setSelectedVehicleId(selectedVehicleId); }}
                className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 font-medium flex-shrink-0"
              >
                <Plus className="w-4 h-4" /> Log Service
              </button>
            </div>

            {/* Summary Cards */}
            {selectedVehicleId && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-lg border border-gray-200 p-3 text-sm">
                  <div className="text-xs text-gray-500 mb-1 font-medium">Last Oil Change</div>
                  {oilChanges[0] ? (
                    <>
                      <div className="font-semibold text-gray-800">{new Date(oilChanges[0].performed_at).toLocaleDateString()}</div>
                      {oilChanges[0].mileage_at_service && <div className="text-xs text-gray-500">at {oilChanges[0].mileage_at_service.toLocaleString()} mi</div>}
                      {oilChanges[0].next_due_mileage && (
                        <div className={`text-xs mt-1 font-medium ${getDueAlert(oilChanges[0]) === 'red' ? 'text-red-600' : getDueAlert(oilChanges[0]) === 'amber' ? 'text-amber-600' : 'text-gray-500'}`}>
                          Next due: {oilChanges[0].next_due_mileage.toLocaleString()} mi
                          {oilChanges[0].next_due_date && ` or ${new Date(oilChanges[0].next_due_date).toLocaleDateString()}`}
                        </div>
                      )}
                    </>
                  ) : <div className="text-gray-400 text-xs">No record</div>}
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-3 text-sm">
                  <div className="text-xs text-gray-500 mb-1 font-medium">Last Inspection</div>
                  {inspections[0] ? (
                    <>
                      <div className="font-semibold text-gray-800">{new Date(inspections[0].performed_at).toLocaleDateString()}</div>
                      <div className={`text-xs mt-1 font-medium ${getDueAlert(inspections[0]) === 'red' ? 'text-red-600' : getDueAlert(inspections[0]) === 'amber' ? 'text-amber-600' : 'text-gray-500'}`}>
                        {inspections[0].next_due_date ? `Next due: ${new Date(inspections[0].next_due_date).toLocaleDateString()}` : ''}
                      </div>
                    </>
                  ) : <div className="text-gray-400 text-xs">No record</div>}
                </div>
                <div className="col-span-2 bg-white rounded-lg border border-gray-200 p-3 text-sm">
                  <div className="text-xs text-gray-500 mb-1 font-medium">Total Maintenance Cost — {thisYear}</div>
                  <div className="text-lg font-bold text-gray-800">${yearCost.toFixed(2)}</div>
                </div>
              </div>
            )}

            {/* Log Service Form */}
            {showMaintenanceForm && (
              <div className="bg-white rounded-lg shadow-md p-4 border border-blue-100 space-y-3">
                <h3 className="font-semibold text-gray-800">Log Service Record</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle *</label>
                    <select
                      value={selectedVehicleId}
                      onChange={e => setSelectedVehicleId(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded text-sm"
                    >
                      <option value="">Select vehicle</option>
                      {vehicles.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Service Type *</label>
                    <select value={maintenanceForm.type} onChange={e => setMaintenanceForm(p => ({ ...p, type: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded text-sm">
                      {MAINTENANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                    <input type="text" value={maintenanceForm.description} onChange={e => setMaintenanceForm(p => ({ ...p, description: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="Brief description" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Cost ($)</label>
                    <input type="number" step="0.01" value={maintenanceForm.cost} onChange={e => setMaintenanceForm(p => ({ ...p, cost: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Mileage at Service</label>
                    <input type="number" value={maintenanceForm.mileage_at_service} onChange={e => setMaintenanceForm(p => ({ ...p, mileage_at_service: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="e.g. 45000" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Next Due Mileage</label>
                    <input type="number" value={maintenanceForm.next_due_mileage} onChange={e => setMaintenanceForm(p => ({ ...p, next_due_mileage: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="Optional" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Next Due Date</label>
                    <input type="date" value={maintenanceForm.next_due_date} onChange={e => setMaintenanceForm(p => ({ ...p, next_due_date: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Performed By</label>
                    <input type="text" value={maintenanceForm.performed_by} onChange={e => setMaintenanceForm(p => ({ ...p, performed_by: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="Shop or name" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Date Performed</label>
                    <input type="date" value={maintenanceForm.performed_at} onChange={e => setMaintenanceForm(p => ({ ...p, performed_at: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded text-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                    <textarea value={maintenanceForm.notes} onChange={e => setMaintenanceForm(p => ({ ...p, notes: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded text-sm" rows={2} placeholder="Additional notes" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setShowMaintenanceForm(false); setMaintenanceError(''); }}
                    className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                  <button onClick={handleSaveMaintenance} disabled={maintenanceLoading}
                    className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    {maintenanceLoading ? 'Saving...' : 'Save Record'}
                  </button>
                </div>
              </div>
            )}

            {/* Delete confirmation */}
            {maintenanceDeleteId && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800 font-medium mb-3">Delete this maintenance record? This cannot be undone.</p>
                <div className="flex gap-2">
                  <button onClick={() => setMaintenanceDeleteId(null)}
                    className="flex-1 py-1.5 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50">Cancel</button>
                  <button
                    onClick={() => {
                      const rec = maintenanceRecords.find(r => r.id === maintenanceDeleteId);
                      if (rec) handleDeleteMaintenance(rec.vehicle_id, rec.id);
                    }}
                    disabled={maintenanceLoading}
                    className="flex-1 py-1.5 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                    {maintenanceLoading ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            )}

            {/* Maintenance log table */}
            {maintenanceLoading && !maintenanceRecords.length ? (
              <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-10">
                <Wrench className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No maintenance records yet. Log your first service above.</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left p-3 font-medium text-gray-600">Date</th>
                      <th className="text-left p-3 font-medium text-gray-600">Vehicle</th>
                      <th className="text-left p-3 font-medium text-gray-600">Service</th>
                      <th className="text-left p-3 font-medium text-gray-600 hidden md:table-cell">Description</th>
                      <th className="text-left p-3 font-medium text-gray-600 hidden sm:table-cell">Mileage</th>
                      <th className="text-left p-3 font-medium text-gray-600">Cost</th>
                      <th className="text-left p-3 font-medium text-gray-600 hidden lg:table-cell">Next Due</th>
                      <th className="text-left p-3 font-medium text-gray-600 hidden md:table-cell">By</th>
                      <th className="p-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredRecords.map(r => {
                      const dueDateAlert = (() => {
                        if (!r.next_due_date) return null;
                        const due = new Date(r.next_due_date);
                        const diff = (due - now) / (1000 * 60 * 60 * 24);
                        if (diff < 0) return 'red';
                        if (diff <= 30) return 'amber';
                        return null;
                      })();
                      return (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="p-3 text-gray-700 whitespace-nowrap">{new Date(r.performed_at).toLocaleDateString()}</td>
                          <td className="p-3 text-gray-700">{r.vehicle_name}</td>
                          <td className="p-3 font-medium text-gray-900">{r.type}</td>
                          <td className="p-3 text-gray-500 hidden md:table-cell">{r.description || '—'}</td>
                          <td className="p-3 text-gray-500 hidden sm:table-cell">{r.mileage_at_service ? r.mileage_at_service.toLocaleString() + ' mi' : '—'}</td>
                          <td className="p-3 text-gray-700">{r.cost ? `$${parseFloat(r.cost).toFixed(2)}` : '—'}</td>
                          <td className="p-3 hidden lg:table-cell">
                            {r.next_due_date ? (
                              <span className={`text-xs font-medium ${dueDateAlert === 'red' ? 'text-red-600' : dueDateAlert === 'amber' ? 'text-amber-600' : 'text-gray-500'}`}>
                                {dueDateAlert === 'red' ? '🔴 ' : dueDateAlert === 'amber' ? '🟡 ' : ''}
                                {new Date(r.next_due_date).toLocaleDateString()}
                              </span>
                            ) : r.next_due_mileage ? (
                              <span className="text-xs text-gray-500">{r.next_due_mileage.toLocaleString()} mi</span>
                            ) : '—'}
                          </td>
                          <td className="p-3 text-gray-500 hidden md:table-cell">{r.performed_by || '—'}</td>
                          <td className="p-3">
                            <button onClick={() => setMaintenanceDeleteId(r.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Vehicles Section ─────────────────────────────────────────────── */}
      {fleetSection === 'vehicles' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={openAddVehicle}
              className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium"
            >
              <Plus className="w-4 h-4" /> Add Vehicle
            </button>
          </div>

          {/* Add/Edit Vehicle Form */}
          {showVehicleForm && (
            <div className="bg-white rounded-lg shadow-md p-4 border border-blue-100">
              <h3 className="font-semibold text-gray-800 mb-3">{editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}</h3>
              {vehicleError && <div className="text-sm text-red-600 bg-red-50 p-2 rounded mb-3">{vehicleError}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Unit Name *</label>
                  <input type="text" value={vehicleForm.name} onChange={e => setVehicleForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded text-sm" placeholder='e.g. "Unit 4"' />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                  <select value={vehicleForm.type} onChange={e => setVehicleForm(p => ({ ...p, type: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded text-sm">
                    <option value="">Select type</option>
                    <option value="Van">Van</option>
                    <option value="Sprinter Van">Sprinter Van</option>
                    <option value="Ford Transit">Ford Transit</option>
                    <option value="SUV">SUV</option>
                    <option value="Sedan">Sedan</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select value={vehicleForm.status} onChange={e => setVehicleForm(p => ({ ...p, status: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded text-sm">
                    <option value="Available">Available</option>
                    <option value="In Use">In Use</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Assigned Driver</label>
                  <select value={vehicleForm.driverId} onChange={e => setVehicleForm(p => ({ ...p, driverId: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded text-sm">
                    <option value="">None</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                  <input type="text" value={vehicleForm.notes} onChange={e => setVehicleForm(p => ({ ...p, notes: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="Optional notes" />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => { setShowVehicleForm(false); setEditingVehicle(null); setVehicleError(''); }}
                  className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={handleSaveVehicle} disabled={vehicleLoading || !vehicleForm.name.trim()}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {vehicleLoading ? 'Saving...' : editingVehicle ? 'Save Changes' : 'Add Vehicle'}
                </button>
              </div>
            </div>
          )}

          {/* Delete Confirmation */}
          {vehicleDeleteId && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800 font-medium mb-3">
                Delete vehicle "{vehicles.find(v => v.id === vehicleDeleteId)?.name}"? This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setVehicleDeleteId(null)}
                  className="flex-1 py-1.5 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={() => handleDeleteVehicle(vehicleDeleteId)} disabled={vehicleLoading}
                  className="flex-1 py-1.5 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                  {vehicleLoading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          )}

          {/* Vehicles Table */}
          {vehicles.length === 0 ? (
            <div className="text-center py-10">
              <Truck className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No vehicles on file. Add one to get started.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left p-3 font-medium text-gray-600">Unit</th>
                    <th className="text-left p-3 font-medium text-gray-600 hidden sm:table-cell">Type</th>
                    <th className="text-left p-3 font-medium text-gray-600">Status</th>
                    <th className="text-left p-3 font-medium text-gray-600 hidden sm:table-cell">Driver</th>
                    <th className="p-3 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {vehicles.map(v => (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="p-3">
                        <div className="font-medium text-gray-900">{v.name}</div>
                        {v.notes && <div className="text-xs text-gray-400 mt-0.5">{v.notes}</div>}
                      </td>
                      <td className="p-3 text-gray-500 hidden sm:table-cell">{v.type || '—'}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${VEHICLE_STATUS_COLORS[v.status] || 'bg-gray-100 text-gray-600'}`}>
                          {v.status}
                        </span>
                      </td>
                      <td className="p-3 text-gray-500 hidden sm:table-cell">{v.driver || '—'}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openEditVehicle(v)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => { setVehicleDeleteId(v.id); setShowVehicleForm(false); }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  funeralHomeId: '',
  pickupLocation: '',
  pickupLocationType: 'Residential',
  destination: '',
  destinationLocationType: 'Funeral Home/Care Center',
  decedentName: '',
  dateOfBirth: '',
  dateOfDeath: '',
  weight: '',
  funeralHomeName: '',
  funeralHomePhone: '',
  pickupContact: '',
  pickupPhone: '',
  destinationContact: '',
  destinationPhone: '',
  caseNumber: '',
  estimatedMiles: 0,
  notes: '',
  isImmediate: true,
  scheduledPickupAt: '',
  assignedUserId: null,
};

const EMPTY_FH_FORM = {
  name: '', address: '', city: '', state: '', zip: '',
  phone: '', email: '', default_destination: '', intake_format: '', notes: ''
};

const locationTypes = [
  'Residential', 'Nursing Home', 'ALF', 'Hospital',
  'Funeral Home/Care Center', 'State Facility', 'Hospice', 'MEO/Lab'
];

// ─── Calendar Tab ─────────────────────────────────────────────────────────────

function cityFromAddress(addr) {
  if (!addr) return '';
  // Try to extract city — look for common patterns like "City, TX" or last comma segment
  const parts = addr.split(',').map(s => s.trim());
  if (parts.length >= 2) return parts[parts.length - 2].trim();
  const words = addr.trim().split(/\s+/);
  return words[words.length - 1] || '';
}

function formatTimeShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function sameDay(dateStr, year, month, day) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d.getFullYear() === year && d.getMonth() + 1 === month && d.getDate() === day;
}

function CalendarTab({ transports, invoices, userRole }) {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [view, setView] = useState('performance'); // 'performance' | 'upcoming'
  const [calendarData, setCalendarData] = useState({ current: [], lastYear: [] });
  const [loadingCal, setLoadingCal] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);     // { year, month, day }
  const [expandedCells, setExpandedCells] = useState({});   // key => bool

  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1; // 1-based

  // Fetch backend calendar data when year/month changes
  useEffect(() => {
    if (view !== 'performance') return;
    setLoadingCal(true);
    apiRequest('GET', `/transports/calendar?year=${year}&month=${month}`)
      .then(data => setCalendarData(data))
      .catch(() => setCalendarData({ current: [], lastYear: [] }))
      .finally(() => setLoadingCal(false));
  }, [year, month, view]);

  // Build days for the grid
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();

  // Build 6×7 grid cells
  const cells = [];
  // Prev month fill
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, currentMonth: false, year: month === 1 ? year - 1 : year, month: month === 1 ? 12 : month - 1 });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, currentMonth: true, year, month });
  }
  // Next month fill
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, currentMonth: false, year: month === 12 ? year + 1 : year, month: month === 12 ? 1 : month + 1 });
  }

  // ── Performance data ──────────────────────────────────────────────────────
  function getPerfTransports(y, mo, d) {
    return calendarData.current.filter(t => sameDay(t.completed_at, y, mo, d));
  }
  function getLastYearCount(mo, d) {
    return calendarData.lastYear.filter(t => {
      if (!t.completed_at) return false;
      const dt = new Date(t.completed_at);
      return dt.getMonth() + 1 === mo && dt.getDate() === d;
    }).length;
  }

  // ── Upcoming data (from transports prop) ─────────────────────────────────
  const upcomingTransports = transports.filter(t => t.scheduledPickupAt && t.status === 'Pending');
  function getUpcomingTransports(y, mo, d) {
    return upcomingTransports.filter(t => sameDay(t.scheduledPickupAt, y, mo, d));
  }

  // ── Monthly summary ───────────────────────────────────────────────────────
  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  const perfSummary = (() => {
    const calls = calendarData.current.length;
    const miles = calendarData.current.reduce((s, t) => s + (parseFloat(t.actual_miles) || 0), 0);
    const revenue = calendarData.current.reduce((s, t) => s + (parseFloat(t.total_cost) || 0), 0);
    return { calls, miles: Math.round(miles), revenue: revenue.toFixed(2) };
  })();

  const upcomingSummary = (() => {
    const calls = upcomingTransports.filter(t => {
      if (!t.scheduledPickupAt) return false;
      const d = new Date(t.scheduledPickupAt);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    }).length;
    return { calls };
  })();

  // ── Year selector ─────────────────────────────────────────────────────────
  const currentYear = today.getFullYear();
  const yearOptions = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  function prevMonth() {
    setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    setExpandedCells({});
  }
  function nextMonth() {
    setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    setExpandedCells({});
  }
  function goToday() {
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setExpandedCells({});
  }

  // ── Day detail modal data ─────────────────────────────────────────────────
  function getSelectedDayTransports() {
    if (!selectedDay) return [];
    const { year: sy, month: sm, day: sd } = selectedDay;
    if (view === 'performance') return getPerfTransports(sy, sm, sd);
    return getUpcomingTransports(sy, sm, sd);
  }

  const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 rounded hover:bg-gray-100 text-gray-600">‹</button>
          <span className="text-lg font-semibold min-w-[160px] text-center">{monthName} {year}</span>
          <button onClick={nextMonth} className="p-1.5 rounded hover:bg-gray-100 text-gray-600">›</button>
          <button onClick={goToday} className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 ml-1">Today</button>
          <select
            value={year}
            onChange={e => { setCurrentDate(new Date(parseInt(e.target.value), month - 1, 1)); setExpandedCells({}); }}
            className="text-xs border border-gray-300 rounded px-2 py-1 text-gray-600"
          >
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {/* View toggle */}
        <div className="flex rounded-lg overflow-hidden border border-gray-300">
          <button
            onClick={() => setView('performance')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${view === 'performance' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            📊 Performance
          </button>
          <button
            onClick={() => setView('upcoming')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${view === 'upcoming' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            📅 Upcoming
          </button>
        </div>
      </div>

      {/* ── Day-of-week headers ─────────────────────────────────────────── */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-t overflow-hidden">
        {DAYS_OF_WEEK.map(d => (
          <div key={d} className="bg-gray-50 text-center text-xs font-semibold text-gray-500 py-2">{d}</div>
        ))}
      </div>

      {/* ── Calendar grid ──────────────────────────────────────────────── */}
      {loadingCal && view === 'performance' && (
        <div className="text-center text-sm text-gray-400 py-4">Loading calendar data…</div>
      )}
      <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-b overflow-hidden">
        {cells.map((cell, idx) => {
          const isToday = cell.currentMonth && cell.day === today.getDate() && cell.year === today.getFullYear() && cell.month === today.getMonth() + 1;
          const cellKey = `${cell.year}-${cell.month}-${cell.day}`;

          let pills = [];
          let lastYearCount = 0;
          let hasUpcoming = false;

          if (view === 'performance') {
            pills = getPerfTransports(cell.year, cell.month, cell.day);
            lastYearCount = cell.currentMonth ? getLastYearCount(cell.month, cell.day) : 0;
          } else {
            pills = getUpcomingTransports(cell.year, cell.month, cell.day);
            hasUpcoming = pills.length > 0;
          }

          const maxPills = expandedCells[cellKey] ? pills.length : 3;
          const overflow = pills.length > 3 && !expandedCells[cellKey] ? pills.length - 3 : 0;
          const visiblePills = pills.slice(0, maxPills);

          return (
            <div
              key={idx}
              onClick={() => pills.length > 0 && setSelectedDay({ year: cell.year, month: cell.month, day: cell.day })}
              className={`relative min-h-[90px] p-1 bg-white transition-colors
                ${cell.currentMonth ? '' : 'opacity-40'}
                ${pills.length > 0 ? 'cursor-pointer hover:bg-gray-50' : ''}
                ${view === 'upcoming' && hasUpcoming ? 'border-l-2 border-blue-400' : ''}
              `}
            >
              {/* Previous year watermark */}
              {view === 'performance' && lastYearCount > 0 && (
                <span className="absolute inset-0 flex items-center justify-center text-5xl font-black text-gray-100 select-none pointer-events-none z-0">
                  {lastYearCount}
                </span>
              )}

              {/* Day number */}
              <div className={`text-xs font-bold mb-1 relative z-10 w-5 h-5 flex items-center justify-center
                ${isToday ? 'bg-gray-900 text-white rounded-full' : cell.currentMonth ? 'text-gray-700' : 'text-gray-400'}
              `}>
                {cell.day}
              </div>

              {/* Event pills */}
              {visiblePills.map((t, i) => (
                view === 'performance' ? (
                  <div key={t.id || i} className="text-[10px] bg-gray-100 border border-gray-300 rounded px-1 py-0.5 mb-0.5 truncate text-gray-700 hover:bg-gray-200 relative z-10">
                    🕊️ {t.funeral_home_name} · {t.case_number} · ${parseFloat(t.total_cost || 0).toFixed(0)} · {cityFromAddress(t.pickup_location)} · {t.actual_miles || 0}mi
                  </div>
                ) : (
                  <div key={t.id || i} className="text-[10px] bg-blue-50 border border-blue-300 rounded px-1 py-0.5 mb-0.5 truncate text-blue-700 hover:bg-blue-100 relative z-10">
                    ⏰ {t.funeralHomeName} · {t.caseNumber} · {cityFromAddress(t.pickupLocation)} · {formatTimeShort(t.scheduledPickupAt)}
                  </div>
                )
              ))}

              {overflow > 0 && (
                <div
                  onClick={e => { e.stopPropagation(); setExpandedCells(prev => ({ ...prev, [cellKey]: true })); }}
                  className="text-[10px] text-blue-600 cursor-pointer hover:underline relative z-10"
                >
                  +{overflow} more
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Monthly summary bar ─────────────────────────────────────────── */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-600">
        {view === 'performance'
          ? <><strong>{monthName} {year}</strong> — {perfSummary.calls} completed call{perfSummary.calls !== 1 ? 's' : ''} · {perfSummary.miles} miles · ${parseFloat(perfSummary.revenue).toLocaleString(undefined, { minimumFractionDigits: 2 })} revenue</>
          : <><strong>{monthName} {year}</strong> — {upcomingSummary.calls} scheduled call{upcomingSummary.calls !== 1 ? 's' : ''} upcoming</>
        }
      </div>

      {/* ── Day detail modal ────────────────────────────────────────────── */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelectedDay(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900">
                {view === 'performance' ? '🕊️ Completed Transports' : '⏰ Scheduled Pickups'} —{' '}
                {new Date(selectedDay.year, selectedDay.month - 1, selectedDay.day).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </h3>
              <button onClick={() => setSelectedDay(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-4 space-y-3">
              {getSelectedDayTransports().length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No transports for this day.</p>
              )}
              {view === 'performance'
                ? getSelectedDayTransports().map(t => {
                    const inv = invoices?.find(i => i.transportId === t.id || i.transport_id === t.id);
                    const invNum = t.invoice_number || inv?.invoiceNumber || inv?.invoice_number || null;
                    return (
                      <div key={t.id} className="border border-gray-200 rounded-lg p-3 text-sm space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-gray-900">{t.decedent_name || '—'}</span>
                          <span className="text-green-700 font-medium whitespace-nowrap">${parseFloat(t.total_cost || 0).toFixed(2)}</span>
                        </div>
                        <div className="text-gray-500 text-xs">Case: {t.case_number || '—'}</div>
                        <div className="text-gray-600">{t.funeral_home_name || '—'}</div>
                        <div className="text-gray-500 text-xs">{t.pickup_location} → {t.destination}</div>
                        <div className="flex gap-4 text-xs text-gray-400">
                          <span>{t.actual_miles || 0} miles</span>
                          {invNum && <span>Invoice #{invNum}</span>}
                          {t.completed_at && <span>Completed: {new Date(t.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                        </div>
                      </div>
                    );
                  })
                : getSelectedDayTransports().map(t => (
                    <div key={t.id} className="border border-blue-100 rounded-lg p-3 text-sm space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-gray-900">{t.decedentName || '—'}</span>
                        <span className="text-blue-600 font-medium whitespace-nowrap">⏰ {formatTimeShort(t.scheduledPickupAt)}</span>
                      </div>
                      <div className="text-gray-500 text-xs">Case: {t.caseNumber || '—'}</div>
                      <div className="text-gray-600">{t.funeralHomeName || '—'}</div>
                      <div className="text-gray-500 text-xs">{t.pickupLocation} → {t.destination}</div>
                      <div className="text-xs text-gray-400">{t.actualMiles ? `${t.actualMiles} miles` : t.estimatedMiles ? `~${t.estimatedMiles} miles (est)` : ''}</div>
                    </div>
                  ))
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

const FuneralTransportApp = () => {
  const [activeTab, setActiveTab] = useState('request');
  const [userRole, setUserRole] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [transports, setTransports] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [alerts, setAlerts] = useState([]);  // unread notification banners
  const [showForm, setShowForm] = useState(false);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [showVerifyPrompt, setShowVerifyPrompt] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState(null); // null | 'success' | 'error' | 'checking'
  const [registerData, setRegisterData] = useState({ username: '', email: '', password: '', role: 'funeral_home', inviteCode: '', funeralHomeId: '', funeralHomeName: '', customFuneralHome: '' });
  const [registerError, setRegisterError] = useState('');
  const [regFuneralHomes, setRegFuneralHomes] = useState([]);
  const [regFhLoading, setRegFhLoading] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [etaValues, setEtaValues] = useState({});  // per-transport ETA input state
  const [lastRefresh, setLastRefresh] = useState(null);
  const [showSmartPaste, setShowSmartPaste] = useState(false);
  const [smartPasteText, setSmartPasteText] = useState('');
  const [smartParsing, setSmartParsing] = useState(false);
  const [smartParseResult, setSmartParseResult] = useState(null);
  const [smartParseError, setSmartParseError] = useState('');
  const [smartPasteImage, setSmartPasteImage] = useState(null); // { base64, preview }
  const [showSmartPasteExample, setShowSmartPasteExample] = useState(false);
  const [aiFilledFields, setAiFilledFields] = useState({});
  const [matchedFuneralHome, setMatchedFuneralHome] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(null); // { caseNumber }
  const [copiedId, setCopiedId] = useState(null); // transport id that just got copied
  const [editTransport, setEditTransport] = useState(null); // transport being edited in modal
  const [adminUsersData, setAdminUsersData] = useState(null);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [adminUsersSearch, setAdminUsersSearch] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [cancelConfirmId, setCancelConfirmId] = useState(null);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  // Caller search for intake form (admin/employee assigning transport to a FH user)
  const [callerSearch, setCallerSearch] = useState('');
  const [callerResults, setCallerResults] = useState([]);
  const callerSearchTimer = useRef(null);

  // Invoices state
  const [invoices, setInvoices] = useState([]);
  const [invoicesFilter, setInvoicesFilter] = useState('all');
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [pendingInvoiceCount, setPendingInvoiceCount] = useState(0);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({ transportId: '', funeralHomeName: '', funeralHomeEmail: '', decedentName: '', pickupFee: '', mileageFee: '', obFee: '', adminFee: '10', totalCost: '', actualMiles: '', notes: '', dueDate: '', paymentStatus: 'due' });
  const [invoiceError, setInvoiceError] = useState('');
  const [invoicePreview, setInvoicePreview] = useState(null);
  const [invoicePreviewLoading, setInvoicePreviewLoading] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState(null);

  // Funeral homes
  const [funeralHomes, setFuneralHomes] = useState([]);
  const [funeralHomeCallers, setFuneralHomeCallers] = useState([]);

  // Admin: funeral home manager
  const [fhForm, setFhForm] = useState(EMPTY_FH_FORM);
  const [editingFH, setEditingFH] = useState(null);
  const [showFHForm, setShowFHForm] = useState(false);
  const [fhError, setFhError] = useState('');
  const [fhLoading, setFhLoading] = useState(false);
  const [csvImportResult, setCsvImportResult] = useState(null);
  const [expandedFH, setExpandedFH] = useState(null);
  const [fhCallers, setFhCallers] = useState({});

  const setEtaValue = (transportId, value) => {
    setEtaValues(prev => ({ ...prev, [transportId]: value }));
  };

  // Odometer modal state
  const [odometerModal, setOdometerModal] = useState(null); // { transportId, newStatus, eta, type: 'start'|'end', odometerStart }
  const [odometerInput, setOdometerInput] = useState('');
  const [odometerLoading, setOdometerLoading] = useState(false);

  // Toast state
  const [toastMessage, setToastMessage] = useState('');
  const showToast = (msg, durationMs = 3500) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), durationMs);
  };

  // Auto mileage estimation state
  const [milesEstimating, setMilesEstimating] = useState(false);
  const [milesEstimateLabel, setMilesEstimateLabel] = useState('');
  const milesDebounceRef = useRef(null);

  // ── Data fetch ───────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const [transportsRes, driversRes, vehiclesRes, fhRes] = await Promise.all([
        apiRequest('GET', '/transports'),
        apiRequest('GET', '/drivers'),
        apiRequest('GET', '/vehicles'),
        apiRequest('GET', '/funeral-homes'),
      ]);
      setTransports(transportsRes.transports || []);
      setDrivers(driversRes.drivers || []);
      setVehicles(vehiclesRes.vehicles || []);
      setFuneralHomes(fhRes.funeralHomes || []);
      setLastRefresh(new Date());
      // Fetch invoice counts for badge (admin only)
      try {
        const { counts } = await apiRequest('GET', '/invoices/counts');
        setPendingInvoiceCount((counts.draft || 0) + (counts.approved || 0));
      } catch (_) {}
    } catch (err) {
      setApiError(err.message);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const { notifications } = await apiRequest('GET', '/notifications');
      if (notifications && notifications.length > 0) {
        setAlerts(prev => {
          const existingIds = new Set(prev.map(a => a.id));
          const newOnes = notifications.filter(n => !existingIds.has(n.id));
          return [...newOnes, ...prev];
        });
      }
    } catch (_) {}
  }, []);

  // ── Email verification link handler ─────────────────────────────────────

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get('verify');
    if (!verifyToken) return;
    setVerifyStatus('checking');
    // Redirect to backend verify endpoint — it returns an HTML page
    window.location.href = `/api/auth/verify-email?token=${verifyToken}`;
  }, []);

  // ── Session restore ──────────────────────────────────────────────────────

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiRequest('GET', '/auth/me')
      .then(({ user }) => {
        setCurrentUser(user);
        setUserRole(user.role);
        setIsLoggedIn(true);
        setActiveTab(user.role === 'funeral_home' ? 'request' : 'dispatch');
      })
      .catch(() => setToken(null));
  }, []);

  // ── Pre-fill intake form with FH defaults on login ──────────────────────

  useEffect(() => {
    if (!isLoggedIn || userRole !== 'funeral_home') return;
    apiRequest('GET', '/auth/defaults').then(data => {
      if (!data.defaults) return;
      const d = data.defaults;
      setFormData(prev => ({
        ...prev,
        ...(d.default_destination && !prev.destination ? { destination: d.default_destination } : {}),
        ...(d.default_contact_name && !prev.pickupContact ? { pickupContact: d.default_contact_name } : {}),
        ...(d.default_contact_phone && !prev.pickupPhone ? { pickupPhone: d.default_contact_phone } : {}),
      }));
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, userRole]);

  // ── Initial load + polling ───────────────────────────────────────────────

  useEffect(() => {
    if (!isLoggedIn) return;
    fetchData();
    fetchNotifications();

    const interval = setInterval(() => {
      fetchData();
      fetchNotifications();
    }, 12000);  // poll every 12 seconds

    return () => clearInterval(interval);
  }, [isLoggedIn, fetchData, fetchNotifications]);

  // Pre-fill invoice form when transport selected via /preview endpoint
  useEffect(() => {
    if (!invoiceForm.transportId) {
      setInvoicePreview(null);
      return;
    }
    setInvoicePreviewLoading(true);
    apiRequest('GET', `/invoices/preview/${invoiceForm.transportId}`)
      .then(({ preview }) => {
        setInvoicePreview(preview);
        setInvoiceForm(prev => ({
          ...prev,
          funeralHomeName: preview.funeralHomeName || prev.funeralHomeName,
          funeralHomeEmail: preview.funeralHomeEmail || prev.funeralHomeEmail,
          decedentName: preview.decedentName || prev.decedentName,
          pickupFee: String(preview.pickupFee ?? prev.pickupFee),
          mileageFee: String(preview.mileageFee ?? prev.mileageFee),
          obFee: String(preview.obFee ?? prev.obFee),
          adminFee: '10',
          totalCost: String(preview.total ?? prev.totalCost),
          actualMiles: String(preview.actualMiles || prev.actualMiles),
          dueDate: preview.dueDateIso || prev.dueDate,
        }));
      })
      .catch(() => {})
      .finally(() => setInvoicePreviewLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceForm.transportId]);

  // Auto-dismiss alerts after 30 seconds; auto-close notif panel when empty
  useEffect(() => {
    if (alerts.length === 0) { setShowNotifPanel(false); return; }
    const timer = setTimeout(() => {
      if (alerts.length > 0) {
        const oldest = alerts[alerts.length - 1];
        dismissAlert(oldest.id);
      }
    }, 30000);
    return () => clearTimeout(timer);
  }, [alerts]);

  // ── Alert management ─────────────────────────────────────────────────────

  const dismissAlert = useCallback(async (notificationId) => {
    setAlerts(prev => prev.filter(a => a.id !== notificationId));
    try {
      await apiRequest('PUT', `/notifications/${notificationId}/read`);
    } catch (_) {}
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      // Auto-estimate miles when both pickup and destination have content (debounced)
      if (field === 'pickupLocation' || field === 'destination') {
        const pickup = field === 'pickupLocation' ? value : next.pickupLocation;
        const dest = field === 'destination' ? value : next.destination;
        if (pickup && dest && pickup.length >= 10 && dest.length >= 10) {
          if (milesDebounceRef.current) clearTimeout(milesDebounceRef.current);
          milesDebounceRef.current = setTimeout(() => autoEstimateMiles(pickup, dest), 2000);
        }
      }
      return next;
    });
    if (aiFilledFields[field]) {
      setAiFilledFields(prev => { const n = { ...prev }; delete n[field]; return n; });
    }
  };

  const autoEstimateMiles = async (pickup, dest) => {
    setMilesEstimating(true);
    setMilesEstimateLabel('');
    try {
      // Geocode pickup
      const geocode = async (addr) => {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr)}&format=json&limit=1`;
        const res = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'FCR-Transport-App/1.0' } });
        const data = await res.json();
        if (!data.length) return null;
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      };
      const [p1, p2] = await Promise.all([geocode(pickup), geocode(dest)]);
      if (!p1 || !p2) {
        setMilesEstimateLabel('Could not estimate — enter manually');
        return;
      }
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${p1.lon},${p1.lat};${p2.lon},${p2.lat}?overview=false`;
      const res = await fetch(osrmUrl);
      const data = await res.json();
      if (data.code !== 'Ok' || !data.routes.length) {
        setMilesEstimateLabel('Could not estimate — enter manually');
        return;
      }
      const meters = data.routes[0].distance;
      const miles = Math.round(meters / 1609.34);
      setFormData(prev => ({ ...prev, estimatedMiles: String(miles) }));
      setMilesEstimateLabel(`~${miles} miles (estimated)`);
    } catch (_) {
      setMilesEstimateLabel('Could not estimate — enter manually');
    } finally {
      setMilesEstimating(false);
    }
  };

  const handleLogin = async () => {
    setLoginError('');
    if (!loginData.username || !loginData.password) {
      setLoginError('Username and password are required');
      return;
    }
    setLoading(true);
    try {
      const { token, user } = await apiRequest('POST', '/auth/login', loginData);
      setToken(token);
      setCurrentUser(user);
      setUserRole(user.role);
      setIsLoggedIn(true);
      setActiveTab(user.role === 'funeral_home' ? 'request' : 'dispatch');
    } catch (err) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setRegisterError('');
    if (!registerData.username || !registerData.password) {
      setRegisterError('Username and password are required');
      return;
    }
    // Resolve funeral home name for funeral_home role
    let funeralHomeName = null;
    if (registerData.role === 'funeral_home') {
      if (registerData.funeralHomeId === '__custom__') {
        funeralHomeName = registerData.customFuneralHome.trim() || null;
      } else if (registerData.funeralHomeId) {
        const fh = regFuneralHomes.find(f => String(f.id) === String(registerData.funeralHomeId));
        funeralHomeName = fh ? fh.name : null;
      }
    }
    setLoading(true);
    try {
      const payload = {
        username: registerData.username,
        email: registerData.email,
        password: registerData.password,
        role: registerData.role,
        inviteCode: registerData.inviteCode,
        funeralHomeName,
      };
      const result = await apiRequest('POST', '/auth/register', payload);
      if (result.success) {
        // Instant access — show success banner and switch to login
        setRegisterError('');
        setShowRegister(false);
        setLoginError('');
        setLoginData(prev => ({ ...prev, username: registerData.username }));
        setRegisterData({ username: '', email: '', password: '', role: 'funeral_home', inviteCode: '', funeralHomeId: '', funeralHomeName: '', customFuneralHome: '' });
        // Reuse loginError state to show green success (we'll check prefix)
        setLoginError('✅ Account created! You can now log in.');
        return;
      }
      if (result.token) {
        setToken(result.token);
        setCurrentUser(result.user);
        setUserRole(result.user.role);
        setIsLoggedIn(true);
        setActiveTab(result.user.role === 'funeral_home' ? 'request' : 'dispatch');
      }
    } catch (err) {
      setRegisterError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // Load funeral homes list for registration dropdown (public endpoint, no auth needed)
  useEffect(() => {
    if (!showRegister || registerData.role !== 'funeral_home') return;
    setRegFhLoading(true);
    fetch('/api/funeral-homes/public')
      .then(r => r.json())
      .then(data => setRegFuneralHomes(data.funeralHomes || []))
      .catch(() => setRegFuneralHomes([]))
      .finally(() => setRegFhLoading(false));
  }, [showRegister, registerData.role]);

  const handleLogout = async () => {
    try { await apiRequest('POST', '/auth/logout'); } catch (_) {}
    setToken(null);
    setIsLoggedIn(false);
    setCurrentUser(null);
    setUserRole(null);
    setTransports([]);
    setDrivers([]);
    setVehicles([]);
    setAlerts([]);
    setLoginData({ username: '', password: '' });
  };

  const handleCallerSearch = (val) => {
    setCallerSearch(val);
    clearTimeout(callerSearchTimer.current);
    if (val.length < 2) { setCallerResults([]); return; }
    callerSearchTimer.current = setTimeout(async () => {
      try {
        const fhId = formData.funeralHomeId || '';
        const { users } = await apiRequest('GET', `/auth/search-users?q=${encodeURIComponent(val)}${fhId ? `&funeral_home_id=${fhId}` : ''}`);
        setCallerResults(users || []);
      } catch(_) { setCallerResults([]); }
    }, 300);
  };

  const handleSubmitRequest = async () => {
    setLoading(true);
    setApiError('');
    try {
      const { transport } = await apiRequest('POST', '/transports', {
        ...formData,
        weight: parseInt(formData.weight) || 0,
        estimatedMiles: parseInt(formData.estimatedMiles) || 0,
        funeralHomeId: formData.funeralHomeId || undefined,
        scheduledPickupAt: formData.isImmediate ? null : (formData.scheduledPickupAt || null),
        assignedUserId: formData.assignedUserId || undefined,
      });
      setTransports(prev => [transport, ...prev]);
      setFormData(EMPTY_FORM);
      setAiFilledFields({});
      setCallerSearch('');
      setCallerResults([]);
      setShowForm(false);
      setSubmitSuccess({ caseNumber: transport.caseNumber });
      setTimeout(() => setSubmitSuccess(null), 5000);
    } catch (err) {
      setApiError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCase = (caseNum, transportId) => {
    navigator.clipboard.writeText(caseNum).catch(() => {});
    setCopiedId(transportId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const fetchAdminUsers = useCallback(async () => {
    setAdminUsersLoading(true);
    try {
      const data = await apiRequest('GET', '/auth/admin/users-by-funeral-home');
      setAdminUsersData(data);
    } catch (err) {
      console.error('Failed to load users:', err.message);
    } finally {
      setAdminUsersLoading(false);
    }
  }, []);

  const fetchInvoiceCounts = useCallback(async () => {
    try {
      const { counts } = await apiRequest('GET', '/invoices/counts');
      setPendingInvoiceCount((counts.draft || 0) + (counts.approved || 0));
    } catch (_) {}
  }, []);

  const fetchInvoices = useCallback(async (status) => {
    setInvoicesLoading(true);
    try {
      const q = status && status !== 'all' ? `?status=${status}` : '';
      const { invoices: data } = await apiRequest('GET', `/invoices${q}`);
      setInvoices(data || []);
    } catch (err) {
      console.error('Failed to load invoices:', err.message);
    } finally {
      setInvoicesLoading(false);
    }
    // Also refresh counts
    fetchInvoiceCounts();
  }, [fetchInvoiceCounts]);

  const handleCreateInvoice = async () => {
    setInvoiceError('');
    if (!invoiceForm.transportId) { setInvoiceError('Select a transport'); return; }
    try {
      const { invoice } = await apiRequest('POST', '/invoices', {
        transportId: invoiceForm.transportId,
        overrides: {
          pickupFee: parseFloat(invoiceForm.pickupFee) || 0,
          mileageFee: parseFloat(invoiceForm.mileageFee) || 0,
          obFee: parseFloat(invoiceForm.obFee) || 0,
          adminFee: parseFloat(invoiceForm.adminFee) || 10,
          actualMiles: parseInt(invoiceForm.actualMiles) || 0,
          notes: invoiceForm.notes || null,
          dueDate: invoiceForm.dueDate || null,
          paymentStatus: invoiceForm.paymentStatus || 'due',
          funeralHomeEmail: invoiceForm.funeralHomeEmail || null,
        },
      });
      setInvoices(prev => [invoice, ...prev]);
      setShowCreateInvoice(false);
      setInvoicePreview(null);
      setInvoiceForm({ transportId: '', funeralHomeName: '', funeralHomeEmail: '', decedentName: '', pickupFee: '', mileageFee: '', obFee: '', adminFee: '10', totalCost: '', actualMiles: '', notes: '', dueDate: '', paymentStatus: 'due' });
      fetchInvoiceCounts();
    } catch (err) {
      setInvoiceError(err.message);
    }
  };

  const handleApproveInvoice = async (id) => {
    try {
      const { invoice } = await apiRequest('PUT', `/invoices/${id}/approve`);
      setInvoices(prev => prev.map(i => i.id === id ? invoice : i));
      fetchInvoiceCounts();
    } catch (err) { setApiError(err.message); }
  };

  const handleSendInvoice = async (id) => {
    try {
      const { invoice } = await apiRequest('PUT', `/invoices/${id}/send`);
      setInvoices(prev => prev.map(i => i.id === id ? invoice : i));
      fetchInvoiceCounts();
    } catch (err) { setApiError(err.message); }
  };

  const handleMarkPaidInvoice = async (id) => {
    try {
      const { invoice } = await apiRequest('PUT', `/invoices/${id}/mark-paid`);
      setInvoices(prev => prev.map(i => i.id === id ? invoice : i));
      fetchInvoiceCounts();
    } catch (err) { setApiError(err.message); }
  };

  const handleVoidInvoice = async (id) => {
    if (!window.confirm('Void this invoice? This cannot be undone.')) return;
    try {
      const { invoice } = await apiRequest('PUT', `/invoices/${id}/void`);
      setInvoices(prev => prev.map(i => i.id === id ? invoice : i));
      fetchInvoiceCounts();
    } catch (err) { setApiError(err.message); }
  };

  const assignDriverAndVehicle = async (requestId, driverId, vehicleId) => {
    if (!driverId && !vehicleId) {
      setApiError('Please select a driver or vehicle to assign');
      return;
    }
    setLoading(true);
    try {
      const { transport } = await apiRequest('PUT', `/transports/${requestId}/assign`, {
        driverId: driverId || undefined,
        vehicleId: vehicleId || undefined,
      });
      setTransports(prev => prev.map(r => r.id === requestId ? transport : r));
      await fetchData();
    } catch (err) {
      setApiError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const advanceTransportStatus = async (transportId, newStatus, eta = null) => {
    // Show odometer modal for start (Pending→Accepted) and end (Loaded→Completed)
    if (newStatus === 'Accepted') {
      // Pre-fill with latest end reading for this driver
      const transport = transports.find(t => t.id === transportId);
      let prefillOdometer = '';
      if (transport?.assignedDriverId) {
        try {
          const { odometer } = await apiRequest('GET', `/drivers/${transport.assignedDriverId}/latest-odometer`);
          if (odometer) prefillOdometer = String(odometer);
        } catch (_) {}
      }
      setOdometerInput(prefillOdometer);
      setOdometerModal({ transportId, newStatus, eta, type: 'start', odometerStart: null });
      return;
    }
    if (newStatus === 'Completed') {
      const transport = transports.find(t => t.id === transportId);
      setOdometerInput('');
      setOdometerModal({ transportId, newStatus, eta, type: 'end', odometerStart: transport?.odometerStart || null });
      return;
    }
    await doAdvanceTransportStatus(transportId, newStatus, eta);
  };

  const doAdvanceTransportStatus = async (transportId, newStatus, eta = null, odometerReading = null, odometerType = null) => {
    setLoading(true);
    try {
      // Log odometer reading if provided
      if (odometerReading && odometerType) {
        const transport = transports.find(t => t.id === transportId);
        await apiRequest('POST', `/transports/${transportId}/odometer`, {
          reading_type: odometerType,
          odometer: parseInt(odometerReading),
          vehicle_id: transport?.assignedVehicleId || undefined,
        });
      }

      const body = { status: newStatus };
      if (eta) body.eta = eta;
      const { transport } = await apiRequest('PUT', `/transports/${transportId}`, body);
      setTransports(prev => prev.map(t => t.id === transportId ? transport : t));
      // Clear eta input for this transport
      setEtaValues(prev => { const n = { ...prev }; delete n[transportId]; return n; });

      // End-of-day check when completing
      if (newStatus === 'Completed' && transport.assignedDriverId) {
        try {
          const { count } = await apiRequest('GET', `/drivers/${transport.assignedDriverId}/active-count`);
          if (count === 0) {
            await apiRequest('POST', `/drivers/${transport.assignedDriverId}/end-of-day-check`, {});
            showToast('📱 End-of-day notification sent to driver');
          }
        } catch (_) {}
      }
    } catch (err) {
      setApiError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveNotes = async (transportId, notes) => {
    try {
      const { transport } = await apiRequest('PUT', `/transports/${transportId}`, { notes });
      setTransports(prev => prev.map(t => t.id === transportId ? transport : t));
    } catch (err) {
      setApiError(err.message);
    }
  };

  const handleSmartParse = async () => {
    if (!smartPasteText.trim()) return;
    setSmartParsing(true);
    setSmartParseError('');
    setSmartParseResult(null);
    setMatchedFuneralHome(null);
    try {
      const result = await apiRequest('POST', '/transports/parse-intake', { text: smartPasteText });
      setSmartParseResult(result);
      if (result.matched_funeral_home) setMatchedFuneralHome(result.matched_funeral_home);
    } catch (err) {
      setSmartParseError(err.message || 'Failed to parse text');
    } finally {
      setSmartParsing(false);
    }
  };

  const handleFuneralHomeSelect = async (id) => {
    const home = funeralHomes.find(h => String(h.id) === String(id));
    if (home) {
      setFormData(prev => ({
        ...prev,
        funeralHomeId: id,
        funeralHomeName: home.name,
        funeralHomePhone: home.phone || prev.funeralHomePhone,
        ...(home.default_destination ? { destination: home.default_destination } : {}),
      }));
      try {
        const { callers } = await apiRequest('GET', `/funeral-homes/${id}/callers`);
        setFuneralHomeCallers(callers || []);
      } catch (_) {}
    } else {
      setFormData(prev => ({ ...prev, funeralHomeId: '', funeralHomeName: '', funeralHomePhone: '' }));
      setFuneralHomeCallers([]);
    }
  };

  // Admin: funeral home management handlers
  const handleSaveFH = async () => {
    setFhError('');
    setFhLoading(true);
    try {
      if (editingFH) {
        const { funeralHome } = await apiRequest('PUT', `/funeral-homes/${editingFH.id}`, fhForm);
        setFuneralHomes(prev => prev.map(h => h.id === funeralHome.id ? { ...funeralHome, caller_count: h.caller_count } : h));
      } else {
        const { funeralHome } = await apiRequest('POST', '/funeral-homes', fhForm);
        setFuneralHomes(prev => [...prev, { ...funeralHome, caller_count: 0 }]);
      }
      setFhForm(EMPTY_FH_FORM);
      setEditingFH(null);
      setShowFHForm(false);
    } catch (err) {
      setFhError(err.message);
    } finally {
      setFhLoading(false);
    }
  };

  const handleDeleteFH = async (id) => {
    if (!window.confirm('Delete this funeral home?')) return;
    try {
      await apiRequest('DELETE', `/funeral-homes/${id}`);
      setFuneralHomes(prev => prev.filter(h => h.id !== id));
      if (expandedFH === id) setExpandedFH(null);
    } catch (err) {
      setApiError(err.message);
    }
  };

  const handleEditFH = (home) => {
    setEditingFH(home);
    setFhForm({
      name: home.name || '', address: home.address || '', city: home.city || '',
      state: home.state || '', zip: home.zip || '', phone: home.phone || '',
      email: home.email || '', default_destination: home.default_destination || '',
      intake_format: home.intake_format || '', notes: home.notes || ''
    });
    setShowFHForm(true);
    setFhError('');
  };

  const handleCSVImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const fd = new FormData();
    fd.append('file', file);
    try {
      const result = await apiUpload('/funeral-homes/import-csv', fd);
      setCsvImportResult(result);
      await fetchData();
    } catch (err) {
      setApiError(err.message);
    }
  };

  const loadFHCallers = async (id) => {
    if (fhCallers[id]) { setExpandedFH(expandedFH === id ? null : id); return; }
    try {
      const { callers } = await apiRequest('GET', `/funeral-homes/${id}/callers`);
      setFhCallers(prev => ({ ...prev, [id]: callers }));
      setExpandedFH(id);
    } catch (_) {}
  };

  const AI_FIELD_MAP = {
    decedent_name: 'decedentName', date_of_birth: 'dateOfBirth', date_of_death: 'dateOfDeath',
    weight: 'weight', pickup_location: 'pickupLocation', pickup_location_type: 'pickupLocationType',
    pickup_contact: 'pickupContact', pickup_phone: 'pickupPhone', destination: 'destination',
    destination_location_type: 'destinationLocationType', destination_contact: 'destinationContact',
    destination_phone: 'destinationPhone', funeral_home_name: 'funeralHomeName',
    funeral_home_phone: 'funeralHomePhone', case_number: 'caseNumber',
    estimated_miles: 'estimatedMiles', notes: 'notes',
  };

  const applySmartParseResult = () => {
    if (!smartParseResult?.fields) return;
    const f = smartParseResult.fields;
    const locTypeMap = {
      'Hospital': 'Hospital', 'Residential': 'Residential', 'Nursing Home': 'Nursing Home',
      'ALF': 'ALF', 'Funeral Home/Care Center': 'Funeral Home/Care Center',
      'State Facility': 'State Facility', 'Hospice': 'Hospice', 'MEO/Lab': 'MEO/Lab'
    };
    const mfh = matchedFuneralHome;
    setFormData(prev => ({
      ...prev,
      ...(f.decedent_name ? { decedentName: f.decedent_name } : {}),
      ...(f.date_of_birth ? { dateOfBirth: f.date_of_birth } : {}),
      ...(f.date_of_death ? { dateOfDeath: f.date_of_death } : {}),
      ...(f.weight ? { weight: String(f.weight) } : {}),
      ...(f.pickup_location ? { pickupLocation: f.pickup_location } : {}),
      ...(f.pickup_location_type && locTypeMap[f.pickup_location_type] ? { pickupLocationType: locTypeMap[f.pickup_location_type] } : {}),
      ...(f.pickup_contact ? { pickupContact: f.pickup_contact } : {}),
      ...(f.pickup_phone ? { pickupPhone: f.pickup_phone } : {}),
      ...(f.destination ? { destination: f.destination } : {}),
      ...(f.destination_location_type && locTypeMap[f.destination_location_type] ? { destinationLocationType: locTypeMap[f.destination_location_type] } : {}),
      ...(f.destination_contact ? { destinationContact: f.destination_contact } : {}),
      ...(f.destination_phone ? { destinationPhone: f.destination_phone } : {}),
      ...(f.funeral_home_name ? { funeralHomeName: f.funeral_home_name } : {}),
      ...(f.funeral_home_phone ? { funeralHomePhone: f.funeral_home_phone } : {}),
      ...(f.case_number ? { caseNumber: f.case_number } : {}),
      ...(f.estimated_miles ? { estimatedMiles: String(f.estimated_miles) } : {}),
      ...(f.notes ? { notes: f.notes } : {}),
      // Apply matched funeral home
      ...(mfh ? { funeralHomeId: String(mfh.id), funeralHomeName: mfh.name } : {}),
      ...(mfh?.default_destination ? { destination: mfh.default_destination } : {}),
    }));
    // Track which fields were AI-filled and their confidence
    const newAiFields = {};
    Object.entries(f).forEach(([key, val]) => {
      if (val !== null && val !== undefined && AI_FIELD_MAP[key]) {
        newAiFields[AI_FIELD_MAP[key]] = smartParseResult.confidence?.[key] || 'medium';
      }
    });
    setAiFilledFields(newAiFields);
    setShowSmartPaste(false);
    setSmartPasteText('');
    setSmartParseResult(null);
    setMatchedFuneralHome(null);
    setShowForm(true);
  };

  // ── Derived state ────────────────────────────────────────────────────────

  const myTransports = transports;  // funeral home sees their own (filtered by server)
  const pendingCount = transports.filter(t => t.status === 'Pending').length;
  const activeCount = transports.filter(t => !['Pending', 'Completed', 'Cancelled'].includes(t.status)).length;

  // ── Login screen ─────────────────────────────────────────────────────────

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-6 w-full max-w-md">
          <div className="text-center mb-6">
            <img
              src="/logos/wings-only.jpg"
              alt="STAT First Call Removals"
              className="h-20 mx-auto mb-3 object-contain"
            />
            <h1 className="text-xl font-bold text-gray-900">STAT First Call Removals</h1>
            <p className="text-gray-600">Professional Decedent Transportation</p>
            <a href="tel:+12819406525" className="inline-flex items-center gap-1.5 mt-2 text-gray-900 font-semibold text-lg hover:text-gray-600 transition-colors">
              📞 (281) 940-6525
            </a>
          </div>
          {!showRegister ? (
            <div className="space-y-4">
              {loginError && (
                <div className={`px-3 py-2 rounded text-sm ${loginError.startsWith('✅') ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                  {loginError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  value={loginData.username}
                  onChange={(e) => setLoginData(prev => ({ ...prev, username: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={loginData.password}
                  onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter password"
                />
              </div>
              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                <LogIn className="w-4 h-4 inline mr-2" />
                {loading ? 'Logging in...' : 'Login'}
              </button>
              <div className="text-center">
                <button
                  onClick={() => { setShowRegister(true); setLoginError(''); }}
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                >
                  First Time here — click here to get access →
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {registerError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                  {registerError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  value={registerData.username}
                  onChange={(e) => setRegisterData(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  placeholder="Choose a username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={registerData.email}
                  onChange={(e) => setRegisterData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  placeholder="Your email address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={registerData.password}
                  onChange={(e) => setRegisterData(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  placeholder="Min 6 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
                <select
                  value={registerData.role}
                  onChange={(e) => setRegisterData(prev => ({ ...prev, role: e.target.value, inviteCode: '' }))}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                >
                  <option value="funeral_home">Funeral Home</option>
                  <option value="employee">Employee</option>
                </select>
              </div>
              {registerData.role === 'funeral_home' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Funeral Home</label>
                  {regFhLoading ? (
                    <div className="text-sm text-gray-400 py-2">Loading...</div>
                  ) : (
                    <select
                      value={registerData.funeralHomeId}
                      onChange={(e) => setRegisterData(prev => ({ ...prev, funeralHomeId: e.target.value, customFuneralHome: '' }))}
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— Select your funeral home —</option>
                      {regFuneralHomes.map(fh => (
                        <option key={fh.id} value={fh.id}>{fh.name}</option>
                      ))}
                      <option value="__custom__">My funeral home isn't listed — Add it</option>
                    </select>
                  )}
                  {registerData.funeralHomeId === '__custom__' && (
                    <input
                      type="text"
                      value={registerData.customFuneralHome}
                      onChange={(e) => setRegisterData(prev => ({ ...prev, customFuneralHome: e.target.value }))}
                      className="w-full mt-2 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter your funeral home name"
                    />
                  )}
                </div>
              )}
              {registerData.role === 'employee' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Access Code</label>
                  <input
                    type="text"
                    value={registerData.inviteCode}
                    onChange={(e) => setRegisterData(prev => ({ ...prev, inviteCode: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    placeholder="Employee access code"
                  />
                </div>
              )}
              <button
                onClick={handleRegister}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
              <div className="text-center">
                <button
                  onClick={() => { setShowRegister(false); setRegisterError(''); }}
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                >
                  Already have an account? Sign in →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Main app ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gray-900 text-white p-4 shadow-lg">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="relative cursor-pointer" onClick={() => alerts.length > 0 && setShowNotifPanel(p => !p)} title={alerts.length > 0 ? 'View notifications' : undefined}>
              <img
                src="/logos/wings-only.jpg"
                alt="STAT"
                className="h-10 w-auto object-contain rounded"
                style={{ filter: 'invert(1)' }}
              />
              {alerts.length > 0 && (
                <div className="absolute -bottom-1 -right-1 bg-red-500 rounded-full w-5 h-5 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">{alerts.length}</span>
                </div>
              )}
            </div>
            <div>
              <div className="text-xs font-black tracking-[0.4em] text-gray-200 uppercase">STAT</div>
              <div className="text-base font-bold text-white leading-tight">First Call Removals</div>
              <p className="text-gray-300 text-xs">
                {userRole && userRole.replace('_', ' ').toUpperCase()} Portal
                {currentUser && <span className="ml-2 opacity-70">— {currentUser.username}</span>}
                {lastRefresh && (
                  <span className="ml-2 opacity-50">
                    Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowProfileModal(true)}
              className="text-gray-300 hover:text-white text-sm flex items-center gap-1"
              title="My Profile"
            >
              👤 Profile
            </button>
            <button onClick={handleLogout} className="text-gray-300 hover:text-white text-sm">
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Notification dropdown panel */}
      {showNotifPanel && alerts.length > 0 && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Notifications ({alerts.length})</span>
            <button onClick={() => setShowNotifPanel(false)} className="text-blue-400 hover:text-blue-600 text-xs">✕ Close</button>
          </div>
          {alerts.map(alert => (
            <div key={alert.id} className="flex items-start gap-3 bg-white border border-blue-200 rounded-lg p-3">
              <Bell className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-blue-900">{alert.message}</p>
                {alert.decedent_name && <p className="text-xs text-blue-600 mt-0.5">Transport: {alert.decedent_name}</p>}
              </div>
              <button onClick={() => dismissAlert(alert.id)} className="text-blue-300 hover:text-blue-600 text-lg leading-none">×</button>
            </div>
          ))}
          <button
            onClick={() => { alerts.forEach(a => dismissAlert(a.id)); setShowNotifPanel(false); }}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Dismiss all
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="flex overflow-x-auto">
          {userRole === 'funeral_home' && (
            <>
              <TabBtn active={activeTab === 'request'} onClick={() => setActiveTab('request')}>
                <Plus className="w-4 h-4 inline mr-1" />New Request
              </TabBtn>
              <TabBtn active={activeTab === 'requests'} onClick={() => setActiveTab('requests')}>
                <Clock className="w-4 h-4 inline mr-1" />My Transports
                {alerts.length > 0 && <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{alerts.length}</span>}
              </TabBtn>
              <TabBtn active={activeTab === 'vault'} onClick={() => setActiveTab('vault')}>
                🔒 Vault
              </TabBtn>
              <TabBtn active={activeTab === 'profile'} onClick={() => setActiveTab('profile')}>
                👤 My Profile
              </TabBtn>
              <TabBtn active={activeTab === 'documents'} onClick={() => setActiveTab('documents')}>
                📄 Documents
              </TabBtn>
            </>
          )}

          {(userRole === 'employee' || userRole === 'admin') && (
            <>
              {userRole === 'admin' && (
                <TabBtn active={activeTab === 'request'} onClick={() => setActiveTab('request')}>
                  <Plus className="w-4 h-4 inline mr-1" />New Call
                </TabBtn>
              )}
              <TabBtn active={activeTab === 'dispatch'} onClick={() => setActiveTab('dispatch')}>
                <Activity className="w-4 h-4 inline mr-1" />Dispatch Board
                {pendingCount > 0 && <span className="ml-1 bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pendingCount}</span>}
              </TabBtn>
              <TabBtn active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')}>
                📅 Calendar
              </TabBtn>
              <TabBtn active={activeTab === 'assignments'} onClick={() => setActiveTab('assignments')}>
                <Users className="w-4 h-4 inline mr-1" />Assignments
              </TabBtn>
              <TabBtn active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')}>
                <Settings className="w-4 h-4 inline mr-1" />Dashboard
              </TabBtn>
              <TabBtn active={activeTab === 'documents'} onClick={() => setActiveTab('documents')}>
                📄 Documents
              </TabBtn>
              {userRole === 'admin' && (
                <>
                  <TabBtn active={activeTab === 'fleet'} onClick={() => setActiveTab('fleet')}>
                    <Wrench className="w-4 h-4 inline mr-1" />Fleet
                  </TabBtn>
                  <TabBtn active={activeTab === 'funeral-homes'} onClick={() => setActiveTab('funeral-homes')}>
                    <Building2 className="w-4 h-4 inline mr-1" />Funeral Homes
                  </TabBtn>
                  <TabBtn active={activeTab === 'invoices'} onClick={() => setActiveTab('invoices')}>
                    🧾 Invoices{pendingInvoiceCount > 0 && <span className="ml-1 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pendingInvoiceCount}</span>}
                  </TabBtn>
                  <TabBtn active={activeTab === 'users'} onClick={() => setActiveTab('users')}>
                    👥 Users
                  </TabBtn>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {showProfileModal && (
        <ProfileModal
          currentUser={currentUser}
          onClose={() => setShowProfileModal(false)}
          onProfileUpdated={(updatedUser) => setCurrentUser(updatedUser)}
        />
      )}

      {cancelConfirmId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Cancel Transport?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will mark the transport as <strong>Cancelled</strong> and release the assigned driver and vehicle. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setCancelConfirmId(null)}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                No, Keep It
              </button>
              <button
                onClick={async () => {
                  try {
                    const { transport } = await apiRequest('PUT', `/transports/${cancelConfirmId}/cancel`);
                    setTransports(prev => prev.map(t => t.id === transport.id ? transport : t));
                    setCancelConfirmId(null);
                    showToast('Transport cancelled');
                  } catch (err) {
                    showToast('Error: ' + err.message);
                    setCancelConfirmId(null);
                  }
                }}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
              >
                Yes, Cancel It
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 max-w-4xl mx-auto">
        {apiError && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {apiError}
            <button onClick={() => setApiError('')} className="ml-auto">×</button>
          </div>
        )}

        {/* ── Submit Success Confirmation ──────────────────────────────── */}
        {submitSuccess && (
          <div className="mb-4 bg-green-50 border border-green-300 text-green-800 px-4 py-3 rounded-lg flex items-center gap-3 shadow-sm">
            <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">✅ Request Received</p>
              <p className="text-sm">Case <span className="font-mono font-bold">{submitSuccess.caseNumber}</span> — We'll contact you when a driver is assigned.</p>
            </div>
            <button onClick={() => setSubmitSuccess(null)} className="text-green-500 hover:text-green-700 text-xl leading-none">×</button>
          </div>
        )}

        {/* ── New Request Tab (Funeral Homes + Admin) ─────────────────── */}
        {activeTab === 'request' && (userRole === 'funeral_home' || userRole === 'admin') && (
          <div>
            {/* Admin: on-behalf-of selector */}
            {userRole === 'admin' && (
              <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center gap-3">
                <span className="text-indigo-700 font-semibold text-sm whitespace-nowrap">📋 Submitting on behalf of:</span>
                <select
                  value={formData.funeralHomeName}
                  onChange={e => {
                    const selected = funeralHomes.find(h => h.name === e.target.value);
                    handleInputChange('funeralHomeName', e.target.value);
                    if (selected) handleInputChange('funeralHomePhone', selected.phone || '');
                  }}
                  className="flex-1 p-2 border border-indigo-300 rounded bg-white text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">— Select Funeral Home —</option>
                  {funeralHomes.map(h => (
                    <option key={h.id} value={h.name}>{h.name} {h.city ? `— ${h.city}` : ''}</option>
                  ))}
                </select>
              </div>
            )}
            {/* Smart Paste Modal */}
            {showSmartPaste && (
              <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
                  <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center gap-2">
                      <Wand2 className="w-5 h-5 text-purple-600" />
                      <h3 className="font-semibold text-gray-900">Smart Paste — Auto-Fill Form</h3>
                    </div>
                    <button onClick={() => { setShowSmartPaste(false); setSmartParseResult(null); setSmartParseError(''); }} className="text-gray-400 hover:text-gray-600">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-4 space-y-4">
                    {!smartParseResult ? (
                      <>
                        <p className="text-sm text-gray-600">Paste a text message, email, or iMessage forward and we'll extract the transport details automatically.</p>

                        {/* Image input options */}
                        <div className="flex gap-2">
                          <label className="flex-1 flex items-center justify-center gap-2 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-purple-400 hover:text-purple-600 cursor-pointer transition-colors">
                            📷 Take Photo
                            <input type="file" accept="image/*" capture="environment" className="hidden"
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = ev => setSmartPasteImage({ base64: ev.target.result, preview: ev.target.result });
                                reader.readAsDataURL(file);
                              }} />
                          </label>
                          <label className="flex-1 flex items-center justify-center gap-2 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-purple-400 hover:text-purple-600 cursor-pointer transition-colors">
                            🖼️ Upload Screenshot
                            <input type="file" accept="image/*" className="hidden"
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = ev => setSmartPasteImage({ base64: ev.target.result, preview: ev.target.result });
                                reader.readAsDataURL(file);
                              }} />
                          </label>
                        </div>
                        {smartPasteImage && (
                          <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-lg p-3">
                            <img src={smartPasteImage.preview} alt="preview" className="w-16 h-16 object-cover rounded border border-purple-200" />
                            <div className="flex-1 text-sm text-purple-800">
                              📸 Image captured — paste or type any additional text below, then click Parse
                            </div>
                            <button onClick={() => setSmartPasteImage(null)} className="text-purple-400 hover:text-purple-600"><X className="w-4 h-4" /></button>
                          </div>
                        )}

                        <textarea
                          value={smartPasteText}
                          onChange={e => setSmartPasteText(e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          rows={6}
                          placeholder="Paste your text or email here..."
                        />

                        {/* Collapsible example */}
                        <div>
                          <button
                            onClick={() => setShowSmartPasteExample(p => !p)}
                            className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1"
                          >
                            {showSmartPasteExample ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            See example text →
                          </button>
                          {showSmartPasteExample && (
                            <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700 italic">
                              "This is a call for John Smith, DOB 1942-03-15, DOD 2026-03-20. Pickup from 123 Main St Houston TX (Hospital). Weight approx 180 lbs. Contact: Jane Smith 713-555-0100. Delivering to Callaway Jones Funeral Home."
                            </div>
                          )}
                        </div>

                        {smartParseError && (
                          <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{smartParseError}</div>
                        )}
                        <button
                          onClick={() => {
                            if (smartPasteImage) {
                              setSmartPasteText(prev =>
                                prev + (prev ? '\n' : '') + '[Image attached — OCR not yet available, please type key details below]'
                              );
                              setSmartPasteImage(null);
                            }
                            handleSmartParse();
                          }}
                          disabled={smartParsing || (!smartPasteText.trim() && !smartPasteImage)}
                          className="w-full bg-purple-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {smartParsing ? <Loader className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                          {smartParsing ? 'Parsing...' : 'Parse & Fill'}
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-green-700 bg-green-50 p-2 rounded font-medium">
                          ✓ Extracted {Object.values(smartParseResult.fields || {}).filter(Boolean).length} fields. Review and apply:
                        </p>
                        {matchedFuneralHome && (
                          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-sm">
                            <Building2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-indigo-900">Matched: {matchedFuneralHome.name}</span>
                              {matchedFuneralHome.default_destination && (
                                <p className="text-xs text-indigo-600 truncate">Destination will be auto-filled</p>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="space-y-1.5 max-h-64 overflow-y-auto">
                          {Object.entries(smartParseResult.fields || {}).filter(([, v]) => v !== null && v !== undefined).map(([key, value]) => {
                            const conf = smartParseResult.confidence?.[key];
                            const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                            const confColor = conf === 'high' ? 'bg-green-100 text-green-800' : conf === 'medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
                            return (
                              <div key={key} className="flex items-start justify-between gap-2 text-sm bg-gray-50 rounded px-2 py-1.5">
                                <div className="min-w-0">
                                  <span className="text-xs text-gray-500 block">{label}</span>
                                  <span className="font-medium text-gray-900 truncate block">{String(value)}</span>
                                </div>
                                {conf && <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${confColor}`}>{conf}</span>}
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setSmartParseResult(null)} className="flex-1 py-2 px-3 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
                            Re-paste
                          </button>
                          <button onClick={applySmartParseResult} className="flex-1 py-2 px-3 bg-purple-600 text-white rounded-lg font-medium text-sm hover:bg-purple-700">
                            Apply to Form
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!showForm ? (
              <div className="text-center py-12">
                <Truck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-700 mb-2">Request Transport Service</h2>
                <p className="text-gray-500 mb-6">Schedule professional decedent transportation</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => setShowForm(true)}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700"
                  >
                    Create New Request
                  </button>
                  <button
                    onClick={() => setShowSmartPaste(true)}
                    className="bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 flex items-center justify-center gap-2"
                  >
                    <Wand2 className="w-4 h-4" /> Smart Paste
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Transport Request Form</h2>
                  <button
                    onClick={() => setShowSmartPaste(true)}
                    className="flex items-center gap-1.5 text-sm bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-lg hover:bg-purple-100 font-medium"
                  >
                    <Wand2 className="w-4 h-4" /> Smart Paste
                  </button>
                </div>
                <div className="space-y-4">
                  {/* Funeral Home Selection */}
                  <div className="border-b pb-4">
                    <h3 className="font-medium text-gray-700 mb-3">Funeral Home</h3>
                    <div className="grid grid-cols-1 gap-3">
                      <FormField label="Select Funeral Home">
                        <select
                          value={formData.funeralHomeId}
                          onChange={e => handleFuneralHomeSelect(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">— Select a funeral home —</option>
                          {funeralHomes.map(h => (
                            <option key={h.id} value={String(h.id)}>{h.name}</option>
                          ))}
                        </select>
                      </FormField>
                      {funeralHomes.length === 0 && !formData.funeralHomeId && (
                        <p className="text-xs text-gray-500 italic">
                          Which funeral home is this for? (No homes on file — enter name below)
                        </p>
                      )}
                      {funeralHomeCallers.length > 0 && (
                        <FormField label="Caller / Contact">
                          <select
                            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            onChange={e => {
                              const c = funeralHomeCallers.find(x => String(x.id) === e.target.value);
                              if (c) setFormData(prev => ({
                                ...prev,
                                pickupContact: c.name,
                                pickupPhone: c.phone || prev.pickupPhone,
                              }));
                            }}
                          >
                            <option value="">— Select caller (optional) —</option>
                            {funeralHomeCallers.map(c => (
                              <option key={c.id} value={String(c.id)}>{c.name}{c.phone ? ` — ${c.phone}` : ''}</option>
                            ))}
                          </select>
                        </FormField>
                      )}
                    </div>
                  </div>

                  {/* Location Information */}
                  <div className="border-b pb-4">
                    <h3 className="font-medium text-gray-700 mb-3">Location Details</h3>
                    <div className="grid grid-cols-1 gap-3">
                      <FormField label="Pickup Location" confidence={aiFilledFields.pickupLocation}>
                        <input type="text" value={formData.pickupLocation}
                          onChange={(e) => handleInputChange('pickupLocation', e.target.value)}
                          className={`w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 ${aiFilledFields.pickupLocation ? 'bg-blue-50 border-blue-300' : 'border-gray-300'}`}
                          placeholder="Enter pickup address" />
                      </FormField>
                      <FormField label="Pickup Location Type" confidence={aiFilledFields.pickupLocationType}>
                        <select value={formData.pickupLocationType}
                          onChange={(e) => handleInputChange('pickupLocationType', e.target.value)}
                          className={`w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 ${aiFilledFields.pickupLocationType ? 'bg-blue-50 border-blue-300' : 'border-gray-300'}`}>
                          {locationTypes.map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                      </FormField>
                      <FormField label="Final Destination" confidence={aiFilledFields.destination}>
                        <input type="text" value={formData.destination}
                          onChange={(e) => handleInputChange('destination', e.target.value)}
                          className={`w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 ${aiFilledFields.destination ? 'bg-blue-50 border-blue-300' : 'border-gray-300'}`}
                          placeholder="Enter destination address" />
                      </FormField>
                      <FormField label="Destination Location Type" confidence={aiFilledFields.destinationLocationType}>
                        <select value={formData.destinationLocationType}
                          onChange={(e) => handleInputChange('destinationLocationType', e.target.value)}
                          className={`w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 ${aiFilledFields.destinationLocationType ? 'bg-blue-50 border-blue-300' : 'border-gray-300'}`}>
                          {locationTypes.map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                      </FormField>
                      <FormField label="Estimated Miles" confidence={aiFilledFields.estimatedMiles}>
                        <input type="number" value={formData.estimatedMiles}
                          onChange={(e) => handleInputChange('estimatedMiles', e.target.value)}
                          className={`w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 ${aiFilledFields.estimatedMiles ? 'bg-blue-50 border-blue-300' : 'border-gray-300'}`}
                          placeholder="Total trip miles" />
                        <div className="flex items-center gap-2 mt-1.5">
                          <button
                            type="button"
                            onClick={() => autoEstimateMiles(formData.pickupLocation, formData.destination)}
                            disabled={milesEstimating || !formData.pickupLocation || !formData.destination}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded border border-blue-200 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {milesEstimating ? <Loader className="w-3 h-3 animate-spin" /> : '📍'}
                            {milesEstimating ? 'Estimating...' : 'Estimate Miles'}
                          </button>
                          {milesEstimateLabel && (
                            <span className={`text-xs font-medium ${milesEstimateLabel.startsWith('Could') ? 'text-gray-500' : 'text-green-600'}`}>
                              {milesEstimateLabel}
                            </span>
                          )}
                        </div>
                      </FormField>
                    </div>
                  </div>

                  {/* Live Cost Preview */}
                  <div className={`p-4 rounded-lg border ${formData.weight || formData.estimatedMiles ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-gray-700">Estimated Cost</h3>
                      <span className="text-xs text-gray-400 italic">Final cost confirmed after transport</span>
                    </div>
                    {(() => {
                      const b = calculateDetailedCost(
                        formData.pickupLocationType,
                        parseInt(formData.weight) || 0,
                        parseInt(formData.estimatedMiles) || 0
                      );
                      return (
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between text-gray-600"><span>Pickup Fee ({formData.pickupLocationType}):</span><span>${b.pickupFee}</span></div>
                          {b.mileageFee > 0 && <div className="flex justify-between text-gray-600"><span>Mileage ({Math.max(0, (parseInt(formData.estimatedMiles) || 0) - 30)} mi × $3.50):</span><span>${b.mileageFee.toFixed(2)}</span></div>}
                          {!b.mileageFee && <div className="flex justify-between text-gray-400"><span>Mileage (first 30 mi included):</span><span>$0.00</span></div>}
                          {b.obFee > 0 && <div className="flex justify-between text-gray-600"><span>OB Fee ({formData.weight} lbs):</span><span>${b.obFee}</span></div>}
                          <div className="flex justify-between text-gray-600"><span>Administrative Fee:</span><span>${b.adminFee}</span></div>
                          <div className="flex justify-between font-semibold border-t border-blue-200 pt-1 text-gray-900">
                            <span>Total Estimate:</span>
                            <span className="text-blue-700">${b.totalCost.toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Decedent Information */}
                  <div className="border-b pb-4">
                    <h3 className="font-medium text-gray-700 mb-3">Decedent Information</h3>
                    <div className="grid grid-cols-1 gap-3">
                      <FormField label="Full Name" confidence={aiFilledFields.decedentName}>
                        <input type="text" value={formData.decedentName}
                          onChange={(e) => handleInputChange('decedentName', e.target.value)}
                          className={`w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 ${aiFilledFields.decedentName ? 'bg-blue-50 border-blue-300' : 'border-gray-300'}`}
                          placeholder="Decedent's full name" />
                      </FormField>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField label="Date of Birth" confidence={aiFilledFields.dateOfBirth}>
                          <input type="date" value={formData.dateOfBirth}
                            onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                            className={`w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 ${aiFilledFields.dateOfBirth ? 'bg-blue-50 border-blue-300' : 'border-gray-300'}`} />
                        </FormField>
                        <FormField label="Date of Death" confidence={aiFilledFields.dateOfDeath}>
                          <input type="date" value={formData.dateOfDeath}
                            onChange={(e) => handleInputChange('dateOfDeath', e.target.value)}
                            className={`w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 ${aiFilledFields.dateOfDeath ? 'bg-blue-50 border-blue-300' : 'border-gray-300'}`} />
                        </FormField>
                      </div>
                      <FormField label="Weight (lbs)" confidence={aiFilledFields.weight}>
                        <input type="number" value={formData.weight}
                          onChange={(e) => handleInputChange('weight', e.target.value)}
                          className={`w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 ${aiFilledFields.weight ? 'bg-blue-50 border-blue-300' : 'border-gray-300'}`}
                          placeholder="Weight in pounds" />
                      </FormField>
                      <FormField label="Case Number" confidence={aiFilledFields.caseNumber}>
                        <input type="text" value={formData.caseNumber}
                          onChange={(e) => handleInputChange('caseNumber', e.target.value)}
                          className={`w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 ${aiFilledFields.caseNumber ? 'bg-blue-50 border-blue-300' : 'border-gray-300'}`}
                          placeholder="Case reference number" />
                      </FormField>
                    </div>
                  </div>

                  {/* Funeral Home Information */}
                  <div className="border-b pb-4">
                    <h3 className="font-medium text-gray-700 mb-3">Funeral Home Details</h3>
                    <div className="grid grid-cols-1 gap-3">
                      <FormField label="Funeral Home Name" confidence={aiFilledFields.funeralHomeName}>
                        <input type="text" value={formData.funeralHomeName}
                          onChange={(e) => handleInputChange('funeralHomeName', e.target.value)}
                          className={`w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 ${aiFilledFields.funeralHomeName ? 'bg-blue-50 border-blue-300' : 'border-gray-300'}`}
                          placeholder="Funeral home name" />
                      </FormField>
                      <FormField label="Phone Number" confidence={aiFilledFields.funeralHomePhone}>
                        <input type="tel" value={formData.funeralHomePhone}
                          onChange={(e) => handleInputChange('funeralHomePhone', e.target.value)}
                          className={`w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 ${aiFilledFields.funeralHomePhone ? 'bg-blue-50 border-blue-300' : 'border-gray-300'}`}
                          placeholder="(555) 123-4567" />
                      </FormField>
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="border-b pb-4">
                    <h3 className="font-medium text-gray-700 mb-3">Contact Information</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Pickup Contact" confidence={aiFilledFields.pickupContact}>
                        <input type="text" value={formData.pickupContact}
                          onChange={(e) => handleInputChange('pickupContact', e.target.value)}
                          className={`w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 ${aiFilledFields.pickupContact ? 'bg-blue-50 border-blue-300' : 'border-gray-300'}`}
                          placeholder="Contact name" />
                      </FormField>
                      <FormField label="Pickup Phone" confidence={aiFilledFields.pickupPhone}>
                        <input type="tel" value={formData.pickupPhone}
                          onChange={(e) => handleInputChange('pickupPhone', e.target.value)}
                          className={`w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 ${aiFilledFields.pickupPhone ? 'bg-blue-50 border-blue-300' : 'border-gray-300'}`}
                          placeholder="Phone" />
                      </FormField>
                      <FormField label="Destination Contact" confidence={aiFilledFields.destinationContact}>
                        <input type="text" value={formData.destinationContact}
                          onChange={(e) => handleInputChange('destinationContact', e.target.value)}
                          className={`w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 ${aiFilledFields.destinationContact ? 'bg-blue-50 border-blue-300' : 'border-gray-300'}`}
                          placeholder="Contact name" />
                      </FormField>
                      <FormField label="Destination Phone" confidence={aiFilledFields.destinationPhone}>
                        <input type="tel" value={formData.destinationPhone}
                          onChange={(e) => handleInputChange('destinationPhone', e.target.value)}
                          className={`w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 ${aiFilledFields.destinationPhone ? 'bg-blue-50 border-blue-300' : 'border-gray-300'}`}
                          placeholder="Phone" />
                      </FormField>
                    </div>

                    {/* Caller / FH User assignment — admin/employee only */}
                    {(userRole === 'admin' || userRole === 'employee') && (
                      <div className="mt-3">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Assign to FH User <span className="text-gray-400 font-normal">(optional — links transport to their account)</span></label>
                        <div className="relative">
                          <input
                            type="text"
                            value={callerSearch}
                            onChange={e => handleCallerSearch(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                            placeholder="Type name to find funeral home user..."
                            autoComplete="off"
                          />
                          {callerResults.length > 0 && (
                            <div className="absolute z-10 top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1">
                              {callerResults.map(u => (
                                <button key={u.id} type="button"
                                  onClick={() => {
                                    setFormData(prev => ({ ...prev, assignedUserId: u.id }));
                                    setCallerSearch(u.display_name || u.username);
                                    setCallerResults([]);
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-100 last:border-0"
                                >
                                  <span className="font-medium">{u.display_name || u.username}</span>
                                  {u.funeral_home_name && <span className="text-gray-500 ml-2">· {u.funeral_home_name}</span>}
                                </button>
                              ))}
                            </div>
                          )}
                          {formData.assignedUserId && (
                            <button type="button"
                              onClick={() => { setFormData(p => ({ ...p, assignedUserId: null })); setCallerSearch(''); }}
                              className="absolute right-2 top-2 text-gray-400 hover:text-red-500 text-xs"
                            >✕</button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Scheduling */}
                  <div className="border-b pb-4">
                    <h3 className="font-medium text-gray-700 mb-3">Pickup Timing</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="isImmediate" checked={formData.isImmediate}
                            onChange={() => handleInputChange('isImmediate', true)}
                            className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium text-gray-700">Immediate pickup</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="isImmediate" checked={!formData.isImmediate}
                            onChange={() => handleInputChange('isImmediate', false)}
                            className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium text-gray-700">Schedule for later</span>
                        </label>
                      </div>
                      {!formData.isImmediate && (
                        <div>
                          <label className="block text-sm font-medium text-gray-600 mb-1">Scheduled Pickup Date &amp; Time</label>
                          <input type="datetime-local" value={formData.scheduledPickupAt}
                            onChange={e => handleInputChange('scheduledPickupAt', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="font-medium text-gray-700">Notes</h3>
                      {aiFilledFields.notes && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          aiFilledFields.notes === 'high' ? 'bg-green-100 text-green-700' :
                          aiFilledFields.notes === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>AI {aiFilledFields.notes}</span>
                      )}
                    </div>
                    <textarea value={formData.notes}
                      onChange={(e) => handleInputChange('notes', e.target.value)}
                      className={`w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 text-sm ${aiFilledFields.notes ? 'bg-blue-50 border-blue-300' : 'border-gray-300'}`}
                      rows={3}
                      placeholder="Any special instructions or notes..." />
                  </div>
                </div>

                {/* Sticky submit button */}
                <div className="sticky bottom-4 mt-6">
                  <div className="flex gap-3 bg-white p-3 rounded-xl shadow-lg border border-gray-100">
                    <button onClick={() => { setShowForm(false); setAiFilledFields({}); }}
                      className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">
                      Cancel
                    </button>
                    <button onClick={handleSubmitRequest} disabled={loading}
                      className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
                      {loading ? 'Submitting...' : 'Submit Request'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── My Transports Tab (Funeral Homes) ────────────────────────── */}
        {activeTab === 'requests' && userRole === 'funeral_home' && (
          <div>
            <AlertBanners alerts={alerts} onDismiss={dismissAlert} />
            <h2 className="text-lg font-semibold mb-4">My Transports</h2>
            {myTransports.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">No requests submitted</p>
              </div>
            ) : (
              <div className="space-y-4">
                {myTransports.filter(t => t.status !== 'Completed').map((transport) => (
                  <TransportCard key={transport.id} transport={transport} onSaveNotes={saveNotes} onCopyCase={handleCopyCase} copiedId={copiedId} currentUser={currentUser} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Dispatch Board (Admin/Employee) ─────────────────────────── */}
        {activeTab === 'dispatch' && (userRole === 'admin' || userRole === 'employee') && (
          <div>
            {editTransport && (
              <EditTransportModal
                transport={editTransport}
                drivers={drivers}
                vehicles={vehicles}
                onClose={() => setEditTransport(null)}
                onSave={async (id, updates) => {
                  try {
                    const { transport: updated } = await apiRequest('PUT', `/transports/${id}`, updates);
                    setTransports(prev => prev.map(t => t.id === id ? updated : t));
                    setEditTransport(null);
                  } catch (err) {
                    setApiError(err.message);
                  }
                }}
              />
            )}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Live Dispatch Board</h2>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Activity className="w-3 h-3" /> Auto-refreshing every 12s
              </span>
            </div>
            <DispatchBoard
              transports={transports}
              userRole={userRole}
              onAdvance={advanceTransportStatus}
              loading={loading}
              etaValues={etaValues}
              setEtaValue={setEtaValue}
              onAssign={assignDriverAndVehicle}
              drivers={drivers}
              vehicles={vehicles}
              onEdit={t => setEditTransport(t)}
              currentUser={currentUser}
              onCancelRequest={setCancelConfirmId}
            />
          </div>
        )}

        {/* ── Assignments Tab (Admin/Employee) ─────────────────────────── */}
        {activeTab === 'assignments' && (userRole === 'admin' || userRole === 'employee') && (
          <AssignmentsTab
            transports={transports}
            drivers={drivers}
            vehicles={vehicles}
            userRole={userRole}
            onAssign={assignDriverAndVehicle}
            onAdvance={advanceTransportStatus}
            loading={loading}
            etaValues={etaValues}
            setEtaValue={setEtaValue}
          />
        )}

        {/* ── Dashboard Tab (Admin/Employee) ──────────────────────────── */}
        {activeTab === 'dashboard' && (userRole === 'admin' || userRole === 'employee') && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Dashboard</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="font-medium text-gray-700 text-sm">Pending</h3>
                <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="font-medium text-gray-700 text-sm">Active</h3>
                <p className="text-2xl font-bold text-blue-600">{activeCount}</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="font-medium text-gray-700 text-sm">Total</h3>
                <p className="text-2xl font-bold text-gray-700">{transports.length}</p>
              </div>
            </div>

            {/* Pending Calls */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <h3 className="font-medium text-gray-700 mb-3">Pending <span className="text-yellow-600">({pendingCount})</span></h3>
              {pendingCount === 0 ? (
                <p className="text-sm text-gray-400">No pending calls</p>
              ) : (
                <div className="space-y-2">
                  {transports.filter(t => t.status === 'Pending').map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 text-sm">{t.funeralHomeName || '—'}</span>
                          <StatusBadge status={t.status} />
                        </div>
                        <div className="text-xs text-gray-600 mt-0.5">
                          {t.decedentName} · {cityFromAddress(t.pickupLocation)} → {cityFromAddress(t.destination)}
                        </div>
                        <div className="text-xs text-gray-400">{t.caseNumber}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Calls */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <h3 className="font-medium text-gray-700 mb-3">Active Calls</h3>
              {transports.filter(t => !['Completed', 'Cancelled', 'Pending'].includes(t.status)).length === 0 ? (
                <p className="text-sm text-gray-400">No active calls in progress</p>
              ) : (
                <div className="space-y-2">
                  {transports
                    .filter(t => !['Completed', 'Cancelled', 'Pending'].includes(t.status))
                    .map(t => (
                      <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900 text-sm">{t.funeralHomeName || '—'}</span>
                            <StatusBadge status={t.status} />
                          </div>
                          <div className="text-xs text-gray-600 mt-0.5">
                            {t.decedentName} · {cityFromAddress(t.pickupLocation)} → {cityFromAddress(t.destination)}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {t.caseNumber}{t.assignedDriver ? ` · ${t.assignedDriver}` : ''}
                          </div>
                        </div>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-md p-4">
              <h3 className="font-medium text-gray-700 mb-3">Available Drivers</h3>
              <div className="space-y-2">
                {drivers.filter(d => d.status === 'Available').map(driver => (
                  <div key={driver.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <div>
                      <span className="font-medium">{driver.name}</span>
                      <span className="text-sm text-gray-500 ml-2">({driver.currentLocation})</span>
                    </div>
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Available</span>
                  </div>
                ))}
                {drivers.filter(d => d.status === 'Available').length === 0 && (
                  <p className="text-sm text-gray-500">No available drivers</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4">
              <h3 className="font-medium text-gray-700 mb-3">Available Vehicles</h3>
              <div className="space-y-2">
                {vehicles.filter(v => v.status === 'Available').map(vehicle => (
                  <div key={vehicle.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="font-medium">{vehicle.name}</span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Available</span>
                  </div>
                ))}
                {vehicles.filter(v => v.status === 'Available').length === 0 && (
                  <p className="text-sm text-gray-500">No available vehicles</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Vault Tab (Funeral Home) ─────────────────────────────────── */}
        {activeTab === 'vault' && userRole === 'funeral_home' && (
          <VaultTab transports={myTransports} currentUser={currentUser} />
        )}

        {/* ── My Profile Tab (Funeral Home) ───────────────────────────── */}
        {activeTab === 'profile' && userRole === 'funeral_home' && (
          <FHProfileTab currentUser={currentUser} onProfileUpdated={(u) => setCurrentUser(u)} />
        )}

        {/* ── Calendar Tab (Admin/Employee) ────────────────────────────── */}
        {activeTab === 'calendar' && (userRole === 'admin' || userRole === 'employee') && (
          <CalendarTab transports={transports} invoices={invoices} userRole={userRole} />
        )}

        {/* ── Documents Tab ────────────────────────────────────────────── */}
        {activeTab === 'documents' && (
          <DocumentsPanel transports={transports} />
        )}

        {/* ── Invoices Tab (Admin only) ─────────────────────────────────── */}
        {activeTab === 'invoices' && userRole === 'admin' && (
          <InvoicesPanel
            invoices={invoices}
            invoicesFilter={invoicesFilter}
            invoicesLoading={invoicesLoading}
            transports={transports}
            showCreateInvoice={showCreateInvoice}
            setShowCreateInvoice={setShowCreateInvoice}
            invoiceForm={invoiceForm}
            setInvoiceForm={setInvoiceForm}
            invoiceError={invoiceError}
            invoicePreview={invoicePreview}
            invoicePreviewLoading={invoicePreviewLoading}
            viewingInvoice={viewingInvoice}
            setViewingInvoice={setViewingInvoice}
            onFetch={fetchInvoices}
            setInvoicesFilter={setInvoicesFilter}
            onCreate={handleCreateInvoice}
            onApprove={handleApproveInvoice}
            onSend={handleSendInvoice}
            onMarkPaid={handleMarkPaidInvoice}
            onVoid={handleVoidInvoice}
          />
        )}

        {/* ── Fleet Tab (Admin only) ───────────────────────────────────── */}
        {activeTab === 'fleet' && userRole === 'admin' && (
          <FleetTab
            drivers={drivers}
            vehicles={vehicles}
            onRefresh={fetchData}
          />
        )}

        {/* ── Users Tab (Admin only) ───────────────────────────────────── */}
        {activeTab === 'users' && userRole === 'admin' && (
          <AdminUsersPanel />
        )}

        {/* ── Funeral Homes Tab (Admin only) ───────────────────────────── */}
        {activeTab === 'funeral-homes' && userRole === 'admin' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Funeral Home Accounts</h2>
              <div className="flex gap-2">
                <label className="flex items-center gap-1.5 text-sm bg-gray-100 text-gray-700 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-200 cursor-pointer font-medium">
                  <Upload className="w-4 h-4" /> Import CSV
                  <input type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
                </label>
                <button
                  onClick={() => { setShowFHForm(true); setEditingFH(null); setFhForm(EMPTY_FH_FORM); setFhError(''); }}
                  className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium"
                >
                  <Plus className="w-4 h-4" /> Add Funeral Home
                </button>
              </div>
            </div>

            {csvImportResult && (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm">
                <span className="text-green-800 font-medium">
                  CSV Import: {csvImportResult.imported} imported, {csvImportResult.skipped} skipped
                </span>
                <button onClick={() => setCsvImportResult(null)} className="text-green-600 hover:text-green-800">×</button>
              </div>
            )}

            {/* Add / Edit Form */}
            {showFHForm && (
              <div className="bg-white rounded-lg shadow-md p-4 border border-blue-100">
                <h3 className="font-semibold text-gray-800 mb-3">{editingFH ? 'Edit Funeral Home' : 'Add Funeral Home'}</h3>
                {fhError && <div className="text-sm text-red-600 bg-red-50 p-2 rounded mb-3">{fhError}</div>}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                    <input type="text" value={fhForm.name} onChange={e => setFhForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="Funeral home name" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
                    <input type="text" value={fhForm.address} onChange={e => setFhForm(p => ({ ...p, address: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="Street address" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                    <input type="text" value={fhForm.city} onChange={e => setFhForm(p => ({ ...p, city: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="City" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
                    <input type="text" value={fhForm.state} onChange={e => setFhForm(p => ({ ...p, state: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="TX" maxLength={2} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">ZIP</label>
                    <input type="text" value={fhForm.zip} onChange={e => setFhForm(p => ({ ...p, zip: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="77001" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                    <input type="tel" value={fhForm.phone} onChange={e => setFhForm(p => ({ ...p, phone: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="(555) 123-4567" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                    <input type="email" value={fhForm.email} onChange={e => setFhForm(p => ({ ...p, email: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="info@example.com" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Default Destination (auto-fill address)</label>
                    <input type="text" value={fhForm.default_destination} onChange={e => setFhForm(p => ({ ...p, default_destination: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="Full address to auto-fill on transports" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Intake Format</label>
                    <select value={fhForm.intake_format} onChange={e => setFhForm(p => ({ ...p, intake_format: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded text-sm">
                      <option value="">Not set</option>
                      <option value="structured">Structured</option>
                      <option value="casual">Casual</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                    <textarea value={fhForm.notes} onChange={e => setFhForm(p => ({ ...p, notes: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded text-sm" rows={2} placeholder="Internal notes" />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => { setShowFHForm(false); setEditingFH(null); setFhError(''); }}
                    className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
                    Cancel
                  </button>
                  <button onClick={handleSaveFH} disabled={fhLoading || !fhForm.name.trim()}
                    className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    {fhLoading ? 'Saving...' : editingFH ? 'Save Changes' : 'Add Funeral Home'}
                  </button>
                </div>
              </div>
            )}

            {/* Funeral Homes Table */}
            {funeralHomes.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">No funeral homes on file. Add one or import a CSV.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {funeralHomes.map(home => (
                  <div key={home.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center gap-3 p-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 truncate">{home.name}</span>
                          {home.intake_format && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{home.intake_format}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {[home.address, home.city, home.state, home.zip].filter(Boolean).join(', ')}
                          {home.phone ? ` · ${home.phone}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-gray-500">{home.caller_count || 0} callers</span>
                        <button onClick={() => loadFHCallers(home.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                          {expandedFH === home.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <button onClick={() => handleEditFH(home)}
                          className="text-gray-400 hover:text-blue-600">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteFH(home.id)}
                          className="text-gray-400 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {expandedFH === home.id && (
                      <div className="border-t px-3 pb-3">
                        <h4 className="text-xs font-semibold text-gray-600 mt-2 mb-1">Callers</h4>
                        {(fhCallers[home.id] || []).length === 0 ? (
                          <p className="text-xs text-gray-400 italic">No callers on file</p>
                        ) : (
                          <div className="space-y-1">
                            {(fhCallers[home.id] || []).map(caller => (
                              <div key={caller.id} className="flex items-center gap-2 text-xs text-gray-700 bg-gray-50 rounded px-2 py-1">
                                <User className="w-3 h-3 text-gray-400" />
                                <span className="font-medium">{caller.name}</span>
                                {caller.phone && <span className="text-gray-500">{caller.phone}</span>}
                                {caller.email && <span className="text-gray-500">{caller.email}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Edit Transport Modal ─────────────────────────────────────────────────────

const EditTransportModal = ({ transport, drivers, vehicles, onClose, onSave }) => {
  const [form, setForm] = useState({
    decedentName: transport.decedentName || '',
    pickupLocation: transport.pickupLocation || '',
    pickupLocationType: transport.pickupLocationType || 'Residential',
    destination: transport.destination || '',
    destinationLocationType: transport.destinationLocationType || 'Funeral Home/Care Center',
    weight: transport.weight || '',
    estimatedMiles: transport.estimatedMiles || '',
    notes: transport.notes || '',
    status: transport.status || 'Pending',
    scheduledPickupAt: transport.scheduledPickupAt ? transport.scheduledPickupAt.slice(0, 16) : '',
    assignedDriverId: transport.assignedDriverId || '',
    assignedVehicleId: transport.assignedVehicleId || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(transport.id, {
      ...form,
      weight: parseInt(form.weight) || 0,
      estimatedMiles: parseInt(form.estimatedMiles) || 0,
      scheduledPickupAt: form.scheduledPickupAt || null,
      assignedDriverId: form.assignedDriverId || undefined,
      assignedVehicleId: form.assignedVehicleId || undefined,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h3 className="font-semibold text-gray-900">✏️ Edit Transport — {transport.id}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3">
          {[
            { label: 'Decedent Name', key: 'decedentName', type: 'text' },
            { label: 'Pickup Location', key: 'pickupLocation', type: 'text' },
            { label: 'Destination', key: 'destination', type: 'text' },
            { label: 'Weight (lbs)', key: 'weight', type: 'number' },
            { label: 'Estimated Miles', key: 'estimatedMiles', type: 'number' },
            { label: 'Notes', key: 'notes', type: 'textarea' },
          ].map(({ label, key, type }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              {type === 'textarea' ? (
                <textarea value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded text-sm" rows={2} />
              ) : (
                <input type={type} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded text-sm" />
              )}
            </div>
          ))}

          {[
            { label: 'Pickup Location Type', key: 'pickupLocationType' },
            { label: 'Destination Location Type', key: 'destinationLocationType' },
          ].map(({ label, key }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <select value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded text-sm">
                {['Residential','Nursing Home','ALF','Hospital','Funeral Home/Care Center','State Facility','Hospice','MEO/Lab'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          ))}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded text-sm">
              {['Pending','Accepted','En Route','Arrived','Loaded','Completed'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Scheduled Pickup</label>
            <input type="datetime-local" value={form.scheduledPickupAt}
              onChange={e => setForm(p => ({ ...p, scheduledPickupAt: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Driver</label>
              <select value={form.assignedDriverId} onChange={e => setForm(p => ({ ...p, assignedDriverId: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded text-sm">
                <option value="">— None —</option>
                {(drivers || []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle</label>
              <select value={form.assignedVehicleId} onChange={e => setForm(p => ({ ...p, assignedVehicleId: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded text-sm">
                <option value="">— None —</option>
                {(vehicles || []).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="p-4 border-t flex gap-3 sticky bottom-0 bg-white">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Invoices Panel ──────────────────────────────────────────────────────────

const INVOICE_STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-700 border-gray-300',
  approved: 'bg-blue-100 text-blue-800 border-blue-300',
  sent: 'bg-amber-100 text-amber-800 border-amber-300',
  paid: 'bg-green-100 text-green-800 border-green-300',
  void: 'bg-red-100 text-red-700 border-red-300 line-through',
};

const InvoiceDocCount = ({ transportId }) => {
  const [count, setCount] = useState(null);
  useEffect(() => {
    if (!transportId) return;
    apiRequest('GET', `/transports/${transportId}/documents`)
      .then(({ documents }) => setCount(documents.length))
      .catch(() => setCount(0));
  }, [transportId]);
  if (count === null) return null;
  if (count === 0) return (
    <p className="text-xs text-amber-600 mt-1">⚠️ No documents saved to this transport yet — fill and save the STAT MCS form in the Documents tab first</p>
  );
  return <p className="text-xs text-blue-600 mt-1">📎 {count} document{count !== 1 ? 's' : ''} attached</p>;
};

// ── Invoice HTML preview builder (mirrors backend) ───────────────────────────
function buildInvoiceHtmlClient(inv) {
  const lineItems = inv.lineItems || [];
  const dobLine = inv.decedentDob ? `, DOB: ${inv.decedentDob}` : '';
  const total = parseFloat(inv.totalCost || inv.total || 0).toFixed(2);
  const subtotal = total;
  const invoiceNumber = inv.invoiceNumber || inv.invoice_number || '(pending)';
  const issueDate = inv.issueDate || inv.issue_date || '';
  const serviceDate = inv.serviceDate || inv.service_date || '';
  const dueDate = inv.dueDate || inv.due_date || '';
  const paymentLabel = (inv.paymentStatus || inv.payment_status) === 'paid' ? 'Total Paid' : 'Total Due';
  const customerNameFull = inv.customerNameFull || inv.customer_name_full || inv.funeralHomeName || '';
  const customerStreet = inv.customerStreet || inv.customer_street || '';
  const customerCity = inv.customerCity || inv.customer_city || '';
  const customerState = inv.customerState || inv.customer_state || '';
  const customerZip = inv.customerZip || inv.customer_zip || '';
  const customerPhone = inv.customerPhone || inv.funeral_home_phone || '';
  const customerEmail = inv.customerEmail || inv.funeralHomeEmail || inv.funeral_home_email || '';
  const caseNumber = inv.caseNumber || inv.case_number || '—';
  const decedentName = inv.decedentName || inv.decedent_name || '—';
  const pickupLocation = inv.pickupLocation || inv.pickup_location || '—';
  const deliveryLocation = inv.deliveryLocation || inv.delivery_location || '—';
  const billToLocation = inv.billToLocation || inv.bill_to_location || '—';

  const lineItemRows = lineItems.map(item => `
    <tr style="border-bottom:1px dashed #e5e7eb">
      <td style="padding:12px 32px">
        <div style="font-size:13px;font-weight:500">${item.description}</div>
        ${item.sub_line_1 ? `<div style="font-size:12px;color:#888;font-style:italic">${item.sub_line_1}</div>` : ''}
        ${item.sub_line_2 ? `<div style="font-size:12px;color:#888;font-style:italic">${item.sub_line_2}</div>` : ''}
      </td>
      <td style="text-align:center;padding:12px;font-size:13px">${item.qty}</td>
      <td style="text-align:right;padding:12px;font-size:13px">$${parseFloat(item.unit_price).toFixed(2)}</td>
      <td style="text-align:right;padding:12px 32px;font-size:13px">$${parseFloat(item.amount).toFixed(2)}</td>
    </tr>
  `).join('');

  const cityLine = [customerCity, customerState, customerZip].filter(Boolean).join(' ');

  return `
  <style>@page{size:letter portrait;margin:0.35in}@media print{html{zoom:0.82}}</style>
  <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08)">
    <div style="border-top:4px solid #2d9b6e;padding:24px 32px 16px">
      <table width="100%"><tr>
        <td>
          <div style="font-size:22px;font-weight:700;color:#1a1a2e">🚐 STAT MCS LLC</div>
          <div style="color:#555;font-size:13px;margin-top:4px">8618 Oceanmist Cove Drive<br>Cypress, TX 77433-7573</div>
          <div style="color:#555;font-size:13px">statmcs.com@gmail.com · (281) 940-6525</div>
        </td>
        <td align="right">
          <div style="font-size:13px;color:#555">Invoice #<strong>${invoiceNumber}</strong></div>
          <div style="font-size:13px;color:#555">Issue date: ${issueDate}</div>
        </td>
      </tr></table>
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb">
      <div style="font-size:22px;font-weight:700;color:#1a1a2e">Case# ${caseNumber}, ${decedentName}${dobLine}</div>
      <div style="color:#555;font-size:13px;margin-top:6px">Pickup Location: ${pickupLocation}</div>
      <div style="color:#555;font-size:13px">Delivery Location: ${deliveryLocation}</div>
      <div style="color:#555;font-size:13px">Bill to Location: ${billToLocation}</div>
    </div>
    <table width="100%" style="border-bottom:1px solid #e5e7eb"><tr>
      <td width="40%" style="vertical-align:top;padding:16px 32px">
        <div style="font-weight:700;margin-bottom:6px">Customer</div>
        <div style="font-size:13px;color:#444;line-height:1.6">
          ${customerNameFull}${customerEmail ? `<br>${customerEmail}` : ''}${customerPhone ? `<br>${customerPhone}` : ''}${customerStreet ? `<br>${customerStreet}` : ''}${cityLine ? `<br>${cityLine}` : ''}
        </div>
      </td>
      <td width="30%" style="vertical-align:top;padding:16px">
        <div style="font-weight:700;margin-bottom:6px">Invoice Details</div>
        <div style="font-size:13px;color:#444;line-height:1.6">PDF created ${issueDate}<br><strong>$${total}</strong><br>Service date ${serviceDate}</div>
      </td>
      <td width="30%" style="vertical-align:top;padding:16px">
        <div style="font-weight:700;margin-bottom:6px">Payment</div>
        <div style="font-size:13px;color:#444;line-height:1.6">Due ${dueDate}<br><strong>$${total}</strong></div>
      </td>
    </tr></table>
    <table width="100%" style="border-collapse:collapse">
      <tr style="border-bottom:2px solid #e5e7eb">
        <th style="text-align:left;padding:12px 32px;font-size:13px">Items</th>
        <th style="text-align:center;padding:12px;font-size:13px">Quantity</th>
        <th style="text-align:right;padding:12px;font-size:13px">Price</th>
        <th style="text-align:right;padding:12px 32px;font-size:13px">Amount</th>
      </tr>
      ${lineItemRows}
      <tr style="border-top:1px dashed #d1d5db">
        <td colspan="3" style="text-align:right;padding:8px 8px;font-size:13px;color:#555">Subtotal</td>
        <td style="text-align:right;padding:8px 32px;font-size:13px">$${subtotal}</td>
      </tr>
    </table>
    <table width="100%">
      <tr>
        <td style="font-size:22px;font-weight:700;color:#1a1a2e;padding:16px 32px">${paymentLabel}</td>
        <td style="text-align:right;font-size:22px;font-weight:700;color:#1a1a2e;padding:16px 32px">$${total}</td>
      </tr>
    </table>
    <div style="padding:16px 32px;border-top:1px solid #e5e7eb;color:#888;font-size:12px">
      First Call Removals · firstcallremovals.com · (281) 940-6525
    </div>
  </div>`;
}

const InvoicesPanel = ({ invoices, invoicesFilter, invoicesLoading, transports, showCreateInvoice, setShowCreateInvoice, invoiceForm, setInvoiceForm, invoiceError, invoicePreview, invoicePreviewLoading, viewingInvoice, setViewingInvoice, onFetch, setInvoicesFilter, onCreate, onApprove, onSend, onMarkPaid, onVoid }) => {
  useEffect(() => { onFetch(invoicesFilter); }, [invoicesFilter]);

  const completedTransports = transports.filter(t => t.status === 'Completed');
  const allTransports = transports;

  const recalcTotal = (form) => {
    const t = (parseFloat(form.pickupFee) || 0) + (parseFloat(form.mileageFee) || 0) + (parseFloat(form.obFee) || 0) + (parseFloat(form.adminFee) || 0);
    return String(t.toFixed(2));
  };

  const updateField = (field, value) => {
    setInvoiceForm(prev => {
      const next = { ...prev, [field]: value };
      if (['pickupFee', 'mileageFee', 'obFee', 'adminFee'].includes(field)) {
        next.totalCost = recalcTotal(next);
      }
      return next;
    });
  };

  const filtered = invoices.filter(inv => {
    if (invoicesFilter === 'all') return true;
    if (invoicesFilter === 'pending') return inv.status === 'draft' || inv.status === 'approved';
    return inv.status === invoicesFilter;
  });

    // Build a live preview data object from the current form + preview data
  const livePreviewData = invoicePreview ? {
    ...invoicePreview,
    funeralHomeEmail: invoiceForm.funeralHomeEmail || invoicePreview.funeralHomeEmail,
    pickupFee: parseFloat(invoiceForm.pickupFee) || invoicePreview.pickupFee,
    mileageFee: parseFloat(invoiceForm.mileageFee) || invoicePreview.mileageFee,
    obFee: parseFloat(invoiceForm.obFee) || invoicePreview.obFee,
    actualMiles: parseInt(invoiceForm.actualMiles) || invoicePreview.actualMiles,
    totalCost: parseFloat(invoiceForm.totalCost) || invoicePreview.totalCost,
    dueDate: invoiceForm.dueDate ? new Date(invoiceForm.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : invoicePreview.dueDate,
    paymentStatus: invoiceForm.paymentStatus || 'due',
  } : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">🧾 Invoices</h2>
        <button
          onClick={() => setShowCreateInvoice(true)}
          className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium"
        >
          <Plus className="w-4 h-4" /> Create Invoice
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {[
          { key: 'all', label: 'All' },
          { key: 'pending', label: 'Pending' },
          { key: 'sent', label: 'Sent' },
          { key: 'paid', label: 'Paid' },
          { key: 'void', label: 'Void' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setInvoicesFilter(key)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${invoicesFilter === key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Create Invoice Modal */}
      {showCreateInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center p-2 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl my-4">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10 rounded-t-xl">
              <h3 className="font-semibold text-gray-900">Create Invoice</h3>
              <button onClick={() => setShowCreateInvoice(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <div className="p-4 space-y-4">
              {invoiceError && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{invoiceError}</div>}

              {/* Transport selector */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Transport *</label>
                <select value={invoiceForm.transportId} onChange={e => updateField('transportId', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded text-sm">
                  <option value="">— Select a transport —</option>
                  {completedTransports.map(t => (
                    <option key={t.id} value={t.id}>{t.decedentName || t.id} — {t.funeralHomeName || '?'} ({new Date(t.completedAt || t.date).toLocaleDateString()})</option>
                  ))}
                  {completedTransports.length === 0 && allTransports.map(t => (
                    <option key={t.id} value={t.id}>{t.decedentName || t.id} [{t.status}]</option>
                  ))}
                </select>
              </div>

              {invoicePreviewLoading && (
                <div className="text-center py-4 text-gray-400"><Loader className="w-5 h-5 animate-spin inline mr-2" />Loading transport data...</div>
              )}

              {invoiceForm.transportId && !invoicePreviewLoading && (
                <>
                  {/* Case # info — distinct from Invoice # */}
                  {invoicePreview && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                      <div className="font-semibold text-blue-800 mb-1">Transport Details</div>
                      <div className="text-blue-700">
                        <span className="font-medium">Case #</span> {invoicePreview.caseNumber || '—'}{' '}
                        <span className="text-blue-400 text-xs">(transport control number from STAT MCS form)</span>
                      </div>
                      <div className="text-blue-500 text-xs mt-1">Invoice # will be assigned automatically on save (1001, 1002, …)</div>
                    </div>
                  )}

                  {/* Editable fields */}
                  <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-lg p-3">
                    <div className="col-span-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Adjust Fees</div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Pickup Fee $</label>
                      <input type="number" value={invoiceForm.pickupFee} onChange={e => updateField('pickupFee', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Mileage Fee $</label>
                      <input type="number" value={invoiceForm.mileageFee} onChange={e => updateField('mileageFee', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">OB Fee $</label>
                      <input type="number" value={invoiceForm.obFee} onChange={e => updateField('obFee', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Actual Miles</label>
                      <input type="number" value={invoiceForm.actualMiles} onChange={e => updateField('actualMiles', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label>
                      <input type="date" value={invoiceForm.dueDate} onChange={e => updateField('dueDate', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Payment Status</label>
                      <select value={invoiceForm.paymentStatus} onChange={e => updateField('paymentStatus', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded text-sm">
                        <option value="due">Due</option>
                        <option value="paid">Paid</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Send Invoice To (email)</label>
                      <input type="email" value={invoiceForm.funeralHomeEmail} onChange={e => updateField('funeralHomeEmail', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="billing@funeralhome.com" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                      <textarea value={invoiceForm.notes} onChange={e => updateField('notes', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded text-sm" rows={2} placeholder="Optional notes" />
                    </div>
                    <div className="col-span-2">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Total</div>
                      <div className="text-xl font-bold text-green-700">${invoiceForm.totalCost || '0.00'}</div>
                    </div>
                  </div>

                  {/* Live invoice preview */}
                  {livePreviewData && (
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Invoice Preview</div>
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <div
                          dangerouslySetInnerHTML={{ __html: buildInvoiceHtmlClient(livePreviewData) }}
                          style={{ transform: 'scale(0.75)', transformOrigin: 'top left', width: '133%' }}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-2 pt-2 sticky bottom-0 bg-white pb-2">
                <button onClick={() => setShowCreateInvoice(false)}
                  className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={onCreate} disabled={!invoiceForm.transportId}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40">
                  Save Draft
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice view modal */}
      {viewingInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center p-2 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl my-4">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10 rounded-t-xl">
              <div>
                <h3 className="font-semibold text-gray-900">
                  Invoice #{viewingInvoice.invoiceNumber || viewingInvoice.id}
                  {viewingInvoice.caseNumber && <span className="text-gray-400 font-normal ml-2">— Case #{viewingInvoice.caseNumber}</span>}
                </h3>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${INVOICE_STATUS_COLORS[viewingInvoice.status] || 'bg-gray-100 text-gray-700 border-gray-300'}`}>
                  {viewingInvoice.status}
                </span>
              </div>
              <button onClick={() => setViewingInvoice(null)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <div className="p-4">
              <div
                dangerouslySetInnerHTML={{ __html: buildInvoiceHtmlClient(viewingInvoice) }}
              />
              <div className="flex gap-2 mt-4 pt-4 border-t flex-wrap">
                {viewingInvoice.status === 'draft' && (
                  <>
                    <button onClick={() => { onApprove(viewingInvoice.id); setViewingInvoice(null); }}
                      className="flex-1 text-sm bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 font-medium">
                      ✅ Approve
                    </button>
                    <button onClick={() => { onVoid(viewingInvoice.id); setViewingInvoice(null); }}
                      className="text-sm bg-red-50 text-red-600 border border-red-200 py-2 px-4 rounded-lg hover:bg-red-100 font-medium">
                      🚫 Void
                    </button>
                  </>
                )}
                {viewingInvoice.status === 'approved' && (
                  <>
                    <button onClick={() => { onSend(viewingInvoice.id); setViewingInvoice(null); }}
                      disabled={!viewingInvoice.funeralHomeEmail}
                      className="flex-1 text-sm bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 font-medium disabled:opacity-40">
                      📧 Send Email
                    </button>
                    <button onClick={() => { onVoid(viewingInvoice.id); setViewingInvoice(null); }}
                      className="text-sm bg-red-50 text-red-600 border border-red-200 py-2 px-4 rounded-lg hover:bg-red-100 font-medium">
                      🚫 Void
                    </button>
                  </>
                )}
                {viewingInvoice.status === 'sent' && (
                  <>
                    <button onClick={() => { onMarkPaid(viewingInvoice.id); setViewingInvoice(null); }}
                      className="flex-1 text-sm bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 font-medium">
                      💰 Mark Paid
                    </button>
                    <button onClick={() => { onSend(viewingInvoice.id); }}
                      disabled={!viewingInvoice.funeralHomeEmail}
                      className="text-sm border border-gray-300 text-gray-600 py-2 px-4 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-40">
                      📧 Resend
                    </button>
                    <button onClick={() => { onVoid(viewingInvoice.id); setViewingInvoice(null); }}
                      className="text-sm bg-red-50 text-red-600 border border-red-200 py-2 px-4 rounded-lg hover:bg-red-100 font-medium">
                      🚫 Void
                    </button>
                  </>
                )}
                <button onClick={() => setViewingInvoice(null)}
                  className="flex-1 text-sm border border-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice list */}
      {invoicesLoading ? (
        <div className="text-center py-8 text-gray-400"><Loader className="w-6 h-6 animate-spin mx-auto mb-2" />Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>No invoices {invoicesFilter !== 'all' ? `in "${invoicesFilter}"` : ''}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(inv => (
            <div key={inv.id} className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              {/* Header row: Invoice# | Case# | Status badge | Total | Date */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${INVOICE_STATUS_COLORS[inv.status] || 'bg-gray-100 text-gray-700 border-gray-300'}`}>
                      {inv.status}
                    </span>
                    {inv.invoiceNumber && (
                      <span className="text-sm font-bold text-gray-800">Invoice #{inv.invoiceNumber}</span>
                    )}
                    {inv.caseNumber && (
                      <span className="text-sm font-mono text-gray-500">— Case #{inv.caseNumber}</span>
                    )}
                  </div>
                  <p className="font-semibold text-gray-900">{inv.decedentName || '—'}</p>
                  <p className="text-sm text-gray-500">{inv.funeralHomeName || '—'}</p>
                  {inv.paidAt && <p className="text-xs text-green-600 mt-0.5">Paid {new Date(inv.paidAt).toLocaleDateString()}</p>}
                  {inv.sentAt && !inv.paidAt && <p className="text-xs text-amber-600 mt-0.5">Sent {new Date(inv.sentAt).toLocaleDateString()}</p>}
                  {inv.approvedAt && !inv.sentAt && <p className="text-xs text-blue-600 mt-0.5">Approved {new Date(inv.approvedAt).toLocaleDateString()} by {inv.approvedBy}</p>}
                  {inv.voidedAt && <p className="text-xs text-red-500 mt-0.5">Voided {new Date(inv.voidedAt).toLocaleDateString()}</p>}
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-lg font-bold text-gray-900">${parseFloat(inv.totalCost || 0).toFixed(2)}</p>
                  <p className="text-xs text-gray-400">{new Date(inv.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Action buttons per status */}
              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100 flex-wrap">
                {/* Preview always available */}
                <button onClick={() => setViewingInvoice(inv)}
                  className="text-xs border border-gray-200 text-gray-600 py-1.5 px-3 rounded-lg hover:bg-gray-50 font-medium">
                  👁 Preview
                </button>

                {/* Draft actions */}
                {inv.status === 'draft' && (
                  <>
                    <button onClick={() => onApprove(inv.id)}
                      className="text-xs bg-blue-600 text-white py-1.5 px-3 rounded-lg hover:bg-blue-700 font-medium">
                      ✅ Approve
                    </button>
                    <button onClick={() => onVoid(inv.id)}
                      className="text-xs bg-red-50 text-red-600 border border-red-200 py-1.5 px-3 rounded-lg hover:bg-red-100 font-medium">
                      🚫 Void
                    </button>
                  </>
                )}

                {/* Approved actions */}
                {inv.status === 'approved' && (
                  <>
                    <button onClick={() => onSend(inv.id)}
                      disabled={!inv.funeralHomeEmail}
                      className="text-xs bg-green-600 text-white py-1.5 px-3 rounded-lg hover:bg-green-700 font-medium disabled:opacity-40"
                      title={!inv.funeralHomeEmail ? 'Add email to send' : ''}>
                      📧 Send
                    </button>
                    <button onClick={() => onVoid(inv.id)}
                      className="text-xs bg-red-50 text-red-600 border border-red-200 py-1.5 px-3 rounded-lg hover:bg-red-100 font-medium">
                      🚫 Void
                    </button>
                  </>
                )}

                {/* Sent actions */}
                {inv.status === 'sent' && (
                  <>
                    <button onClick={() => onMarkPaid(inv.id)}
                      className="text-xs bg-green-600 text-white py-1.5 px-3 rounded-lg hover:bg-green-700 font-medium">
                      💰 Mark Paid
                    </button>
                    <button onClick={() => onSend(inv.id)}
                      disabled={!inv.funeralHomeEmail}
                      className="text-xs border border-gray-300 text-gray-600 py-1.5 px-3 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-40"
                      title={!inv.funeralHomeEmail ? 'No email on file' : ''}>
                      📧 Resend
                    </button>
                    <button onClick={() => onVoid(inv.id)}
                      className="text-xs bg-red-50 text-red-600 border border-red-200 py-1.5 px-3 rounded-lg hover:bg-red-100 font-medium">
                      🚫 Void
                    </button>
                  </>
                )}

                {/* Paid / Void: view only — no further actions */}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Transport Chat ───────────────────────────────────────────────────────────

const ROLE_LABEL = { admin: 'Dispatch', employee: 'Driver', funeral_home: 'Funeral Home' };
const ROLE_BADGE_COLOR = { admin: 'bg-gray-200 text-gray-700', employee: 'bg-blue-100 text-blue-700', funeral_home: 'bg-green-100 text-green-700' };

const TransportChat = ({ transportId, currentUser }) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const pollRef = useRef(null);

  const loadMessages = useCallback(async () => {
    try {
      const { messages: msgs } = await apiRequest('GET', `/transports/${transportId}/messages`);
      setMessages(msgs || []);
    } catch (_) {}
  }, [transportId]);

  useEffect(() => {
    if (!open) return;
    loadMessages();
    pollRef.current = setInterval(loadMessages, 15000);
    return () => clearInterval(pollRef.current);
  }, [open, loadMessages]);

  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    // Optimistic
    const optimistic = {
      id: Date.now(),
      transport_id: transportId,
      user_id: currentUser?.id,
      username: currentUser?.username || 'You',
      role: currentUser?.role || 'funeral_home',
      message: text,
      created_at: new Date().toISOString(),
      _optimistic: true,
    };
    setMessages(prev => [...prev, optimistic]);
    try {
      await apiRequest('POST', `/transports/${transportId}/messages`, { message: text });
      await loadMessages();
    } catch (_) {
      setMessages(prev => prev.filter(m => m !== optimistic));
    } finally {
      setSending(false);
    }
  };

  const isOwn = (msg) => msg.user_id === currentUser?.id || msg.username === currentUser?.username;

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 font-medium w-full"
      >
        <span>💬 Chat</span>
        {messages.length > 0 && !open && (
          <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">{messages.length}</span>
        )}
        <span className="ml-auto">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {/* Message list */}
          <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
            {messages.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4 italic">No messages yet — send one to get started</p>
            ) : (
              messages.map(msg => {
                const own = isOwn(msg);
                return (
                  <div key={msg.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${own ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'}`}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-xs font-medium ${own ? 'text-blue-200' : 'text-gray-500'}`}>{msg.username}</span>
                        <span className={`text-xs px-1.5 py-0 rounded-full ${own ? 'bg-blue-500 text-blue-100' : ROLE_BADGE_COLOR[msg.role] || 'bg-gray-200 text-gray-600'}`}>
                          {ROLE_LABEL[msg.role] || msg.role}
                        </span>
                      </div>
                      <p className="break-words">{msg.message}</p>
                      <p className={`text-xs mt-0.5 ${own ? 'text-blue-200' : 'text-gray-400'}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>
          {/* Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Type a message..."
              className="flex-1 text-sm p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
            >
              {sending ? <Loader className="w-4 h-4 animate-spin" /> : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Documents Panel ─────────────────────────────────────────────────────────

const TEMPLATES_VERSION = 'v2';

const STAT_MCS_TEMPLATE = {
  id: 'stat-mcs-first-call',
  name: 'STAT MCS First Call Intake',
  description: 'Official first call intake — complete for every transport',
  printHeader: 'STAT MCS — MEDICAL COURIER SERVICES | www.statmcs.com | (281) 940-6525 | ALL STAT MCS TECHS HAVE GOVERNMENT-ISSUED TWIC CARDS',
  fields: [
    { id:'control_number', label:'Control #', type:'text', autoFill:null },
    { id:'client', label:'Client', type:'text', autoFill:'funeral_home_name' },
    { id:'code', label:'Code', type:'text', autoFill:null },
    { id:'date', label:'Date', type:'date', autoFill:'created_at' },
    { id:'veteran', label:'Veteran?', type:'yn', autoFill:null },
    { id:'family_present', label:'Family Present?', type:'yn', autoFill:null },
    { id:'decomp', label:'DeComp?', type:'yn', autoFill:null },
    { id:'organ_donor', label:'Organ Donor?', type:'yn', autoFill:null },
    { id:'arrival_time', label:'Arrival Time', type:'time', autoFill:null },
    { id:'location_type', label:'Type of Location', type:'select', options:['Residence','ALF','Nursing Home','Hospice','Hospital','ER','Morgue','Funeral Home','Med Exam/Lab','On Scene'], autoFill:'pickup_location_type' },
    { id:'decedent_name', label:'Name of Deceased', type:'text', autoFill:'decedent_name' },
    { id:'sex', label:'Sex', type:'select', options:['Male','Female'], autoFill:null },
    { id:'location_address', label:'Location Address', type:'text', autoFill:'pickup_location' },
    { id:'location_city', label:'City', type:'text', autoFill:null },
    { id:'facility_name', label:'Facility Name', type:'text', autoFill:null },
    { id:'remarks', label:'Remarks', type:'text', autoFill:null },
    { id:'location_phone', label:'Location Phone #', type:'tel', autoFill:'pickup_phone' },
    { id:'contact_primary', label:'Contact (Primary)', type:'text', autoFill:'pickup_contact' },
    { id:'contact_secondary', label:'Contact (Secondary)', type:'text', autoFill:null },
    { id:'stairs_obstacles', label:'Any Stairs/Obstacles?', type:'yn', autoFill:null },
    { id:'stairs_details', label:'If Yes, What?', type:'text', autoFill:null },
    { id:'dob', label:'Date of Birth', type:'date', autoFill:'date_of_birth' },
    { id:'dod', label:'Date of Death', type:'date', autoFill:'date_of_death' },
    { id:'age', label:'Age', type:'number', autoFill:null },
    { id:'tod', label:'Time of Death', type:'time', autoFill:null },
    { id:'weight', label:'Weight (lbs)', type:'number', autoFill:'weight' },
    { id:'extra_tech', label:'Extra Tech?', type:'yn', autoFill:null },
    { id:'after_hours', label:'After Hours?', type:'yn', autoFill:null },
    { id:'body_bag', label:'Body Bag?', type:'yn', autoFill:null },
    { id:'ice', label:'Ice?', type:'yn', autoFill:null },
    { id:'airport_charges', label:'Airport Charges $', type:'currency', autoFill:null },
    { id:'nok_name', label:'Name of NOK', type:'text', autoFill:null },
    { id:'nok_phone', label:'NOK Phone #', type:'tel', autoFill:null },
    { id:'nok_relationship', label:'Relationship', type:'text', autoFill:null },
    { id:'nok_email', label:'NOK Email', type:'email', autoFill:null },
    { id:'doctor_name', label:'Doctor Signing DC', type:'text', autoFill:null },
    { id:'doctor_phone', label:'DR. Phone #', type:'tel', autoFill:null },
    { id:'releasing_authority', label:'Releasing Authority', type:'text', autoFill:null },
    { id:'id_anklet_applied_by', label:'ID Anklet Applied By', type:'text', autoFill:null },
    { id:'no_personal_effects', label:'No Personal Effects (check if none)', type:'checkbox', autoFill:null },
    { id:'effects_table', label:'Personal Effects Inventory', type:'effects_table', autoFill:null },
    { id:'injury_blood', label:'Blood', type:'yn', autoFill:null },
    { id:'injury_bruising', label:'Bruising', type:'yn', autoFill:null },
    { id:'injury_burn', label:'Burn', type:'yn', autoFill:null },
    { id:'injury_cuts', label:'Cuts', type:'yn', autoFill:null },
    { id:'injury_discolored', label:'Discolored', type:'yn', autoFill:null },
    { id:'injury_head', label:'Head Injury', type:'yn', autoFill:null },
    { id:'injury_scar', label:'Recent Scar', type:'yn', autoFill:null },
    { id:'injury_scrapes', label:'Scrapes', type:'yn', autoFill:null },
    { id:'notes', label:'Notes', type:'textarea', autoFill:'notes' },
    { id:'invoice_number', label:'Invoice #', type:'text', autoFill:'case_number' },
    { id:'total', label:'Total $', type:'currency', autoFill:'total_cost' },
    { id:'delivered_to', label:'Remains Delivered To', type:'text', autoFill:'destination_contact' },
    { id:'delivery_address', label:'Delivery Address', type:'text', autoFill:'destination' },
    { id:'delivery_city', label:'Delivery City', type:'text', autoFill:null },
    { id:'technician_name', label:'STAT MCS Technician', type:'text', autoFill:null },
    { id:'sign_date', label:'Sign Date', type:'date', autoFill:null },
    { id:'leave_time', label:'Leave Time', type:'time', autoFill:null },
    { id:'funeral_home_time', label:'Funeral Home Time', type:'time', autoFill:null },
    { id:'loaded_miles', label:'Loaded Miles', type:'number', autoFill:'actual_miles' },
    { id:'print_name', label:'Print Name (Witness)', type:'text', autoFill:null },
    { id:'witness_signature', label:'Witness Signature', type:'signature', autoFill:null },
  ],
};

const DEFAULT_TEMPLATES = [
  STAT_MCS_TEMPLATE,
  {
    id: 'tpl-2',
    name: 'Transport Release Form',
    description: 'Release authorization for transport handoff',
    fields: [
      { id:'decedent_name', label:'Name of Deceased', type:'text', autoFill:'decedent_name' },
      { id:'pickup_location', label:'Pickup Location', type:'text', autoFill:'pickup_location' },
      { id:'destination', label:'Destination', type:'text', autoFill:'destination' },
      { id:'driver_name', label:'Driver Name', type:'text', autoFill:'driver_name' },
      { id:'vehicle_id', label:'Vehicle ID', type:'text', autoFill:'vehicle_id' },
      { id:'notes', label:'Notes', type:'textarea', autoFill:'notes' },
      { id:'signature', label:'Signature', type:'signature', autoFill:null },
      { id:'date_signed', label:'Date Signed', type:'date', autoFill:null },
    ],
  },
  {
    id: 'tpl-3',
    name: 'Chain of Custody',
    description: 'Chain of custody tracking document',
    fields: [
      { id:'decedent_name', label:'Name of Deceased', type:'text', autoFill:'decedent_name' },
      { id:'case_number', label:'Case Number', type:'text', autoFill:'case_number' },
      { id:'pickup_contact', label:'Pickup Contact', type:'text', autoFill:'pickup_contact' },
      { id:'pickup_phone', label:'Pickup Phone', type:'tel', autoFill:'pickup_phone' },
      { id:'destination_contact', label:'Destination Contact', type:'text', autoFill:'destination_contact' },
      { id:'destination_phone', label:'Destination Phone', type:'tel', autoFill:'destination_phone' },
      { id:'signature', label:'Signature', type:'signature', autoFill:null },
      { id:'date_signed', label:'Date Signed', type:'date', autoFill:null },
    ],
  },
];

function getTemplates() {
  try {
    const storedVersion = localStorage.getItem('fcr_doc_templates_version');
    if (storedVersion === TEMPLATES_VERSION) {
      const stored = localStorage.getItem('fcr_doc_templates');
      if (stored) return JSON.parse(stored);
    }
  } catch (_) {}
  localStorage.setItem('fcr_doc_templates', JSON.stringify(DEFAULT_TEMPLATES));
  localStorage.setItem('fcr_doc_templates_version', TEMPLATES_VERSION);
  return DEFAULT_TEMPLATES;
}

function saveTemplates(tpls) {
  localStorage.setItem('fcr_doc_templates', JSON.stringify(tpls));
  localStorage.setItem('fcr_doc_templates_version', TEMPLATES_VERSION);
}

const TRANSPORT_FIELD_MAP = {
  decedent_name: 'decedentName',
  date_of_death: 'dateOfDeath',
  date_of_birth: 'dateOfBirth',
  pickup_location: 'pickupLocation',
  pickup_location_type: 'pickupLocationType',
  funeral_home_name: 'funeralHomeName',
  funeral_home_phone: 'funeralHomePhone',
  pickup_contact: 'pickupContact',
  pickup_phone: 'pickupPhone',
  destination: 'destination',
  destination_contact: 'destinationContact',
  destination_phone: 'destinationPhone',
  case_number: 'caseNumber',
  driver_name: 'assignedDriver',
  vehicle_id: 'assignedVehicleId',
  notes: 'notes',
  weight: 'weight',
  actual_miles: 'actualMiles',
  total_cost: 'totalCost',
  created_at: 'createdAt',
};

const DocumentsPanel = ({ transports }) => {
  const [section, setSection] = useState('templates'); // 'templates' | 'fill'
  const [templates, setTemplates] = useState(getTemplates);
  const [selectedTpl, setSelectedTpl] = useState('stat-mcs-first-call');
  const [selectedTransport, setSelectedTransport] = useState('');
  const [fieldValues, setFieldValues] = useState({});
  const [signatureData, setSignatureData] = useState(null);
  const [savedDocsCount, setSavedDocsCount] = useState(null); // null | number
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'success' | 'error'
  const [saveMessage, setSaveMessage] = useState('');
  const [effectsRows, setEffectsRows] = useState(
    Array.from({ length: 10 }, (_, i) => ({ itemNum: i + 1, qty: '', description: '', jewelry: '', initials: '' }))
  );
  const canvasRef = useRef(null);
  const witnessCanvasRef = useRef(null);
  const isDrawing = useRef(false);
  const isWitnessDrawing = useRef(false);

  // Canvas drawing (mouse + touch)
  const setupCanvas = useCallback((canvas) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches?.[0] || e;
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    };
    const onStart = (e) => { e.preventDefault(); isDrawing.current = true; ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y); };
    const onMove = (e) => { e.preventDefault(); if (!isDrawing.current) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
    const onEnd = () => { isDrawing.current = false; setSignatureData(canvas.toDataURL()); };

    canvas.addEventListener('mousedown', onStart);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseup', onEnd);
    canvas.addEventListener('touchstart', onStart, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onEnd);
  }, []);

  useEffect(() => { if (canvasRef.current) setupCanvas(canvasRef.current); }, [setupCanvas, section, selectedTpl]);

  // Witness signature canvas setup
  const setupWitnessCanvas = useCallback((canvas) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches?.[0] || e;
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    };
    const onStart = (e) => { e.preventDefault(); isWitnessDrawing.current = true; ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y); };
    const onMove = (e) => { e.preventDefault(); if (!isWitnessDrawing.current) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
    const onEnd = () => {
      isWitnessDrawing.current = false;
      setFieldValues(prev => ({ ...prev, witness_signature: canvas.toDataURL() }));
    };
    canvas.addEventListener('mousedown', onStart);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseup', onEnd);
    canvas.addEventListener('touchstart', onStart, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onEnd);
  }, []);

  useEffect(() => { if (witnessCanvasRef.current) setupWitnessCanvas(witnessCanvasRef.current); }, [setupWitnessCanvas, section, selectedTpl]);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) { canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height); }
    setSignatureData(null);
  };

  const clearWitnessSignature = () => {
    const canvas = witnessCanvasRef.current;
    if (canvas) { canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height); }
    setFieldValues(prev => ({ ...prev, witness_signature: null }));
  };

  // Fetch saved docs count when transport is selected
  useEffect(() => {
    if (!selectedTransport) { setSavedDocsCount(null); return; }
    apiRequest('GET', `/transports/${selectedTransport}/documents`)
      .then(({ documents }) => setSavedDocsCount(documents.length))
      .catch(() => setSavedDocsCount(null));
  }, [selectedTransport]);

  // Save to transport handler
  const handleSaveToTransport = async () => {
    if (!selectedTransport) {
      setSaveStatus('error');
      setSaveMessage('Select a transport first');
      setTimeout(() => setSaveStatus(null), 3000);
      return;
    }
    const tpl = templates.find(tp => tp.id === selectedTpl);
    if (!tpl) return;

    // Collect signature — check witness_signature and main signature
    const sig = signatureData || fieldValues.witness_signature || null;

    setSaveStatus('saving');
    try {
      await apiRequest('POST', `/transports/${selectedTransport}/documents`, {
        template_name: tpl.name,
        field_data: JSON.stringify(fieldValues),
        signature_data: sig,
      });
      const transport = transports.find(t => t.id === selectedTransport);
      setSaveStatus('success');
      setSaveMessage(`✅ Document saved to transport #${transport?.caseNumber || selectedTransport}`);
      // Refresh count
      const { documents } = await apiRequest('GET', `/transports/${selectedTransport}/documents`);
      setSavedDocsCount(documents.length);
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (err) {
      setSaveStatus('error');
      setSaveMessage(err.message || 'Failed to save document');
      setTimeout(() => setSaveStatus(null), 4000);
    }
  };

  // Auto-fill from transport
  useEffect(() => {
    if (!selectedTransport) { setFieldValues({}); return; }
    const t = transports.find(tr => tr.id === selectedTransport);
    if (!t) return;
    const tpl = templates.find(tp => tp.id === selectedTpl);
    if (!tpl) return;
    const vals = {};
    for (const field of tpl.fields) {
      // Handle both legacy string fields and new object fields
      if (typeof field === 'string') {
        if (field === 'signature' || field === 'date_signed') continue;
        const key = TRANSPORT_FIELD_MAP[field];
        vals[field] = key ? (t[key] || '') : '';
      } else {
        // New object field with autoFill key
        if (field.type === 'signature') continue;
        if (field.autoFill) {
          const key = TRANSPORT_FIELD_MAP[field.autoFill] || field.autoFill;
          vals[field.id] = t[key] || '';
        }
      }
    }
    if (!vals['date_signed']) vals['date_signed'] = new Date().toLocaleDateString();
    if (!vals['sign_date']) vals['sign_date'] = new Date().toISOString().split('T')[0];
    if (!vals['date']) vals['date'] = new Date().toISOString().split('T')[0];
    setFieldValues(vals);
  }, [selectedTransport, selectedTpl, transports, templates]);

  const handlePrint = () => {
    const tpl = templates.find(tp => tp.id === selectedTpl);
    if (!tpl) return;
    const printDiv = document.createElement('div');
    printDiv.id = 'fcr-print-doc';

    // ── STAT MCS First Call — faithful form layout ──────────────────────
    if (tpl.id === 'stat-mcs-first-call') {
      const fv = fieldValues;
      const yn = (id) => {
        const v = fv[id] || '';
        return `<span class="yn-box${v==='Y'?' selected':''}">Y</span><span class="yn-box${v==='N'?' selected':''}">N</span>`;
      };
      const val = (id) => fv[id] || '';
      const underline = (id, minW) => `<span class="field-value${minW?' short':''}" style="${minW?'min-width:'+minW+'px':''}">${fv[id]||''}</span>`;

      const locationTypes = ['Residence','ALF','Nursing Home','Hospice','Hospital','ER','Morgue','Funeral Home','Med Exam/Lab','On Scene'];
      const selectedLoc = val('location_type');
      const locHtml = locationTypes.map(opt =>
        `<span class="loc-option${opt===selectedLoc?' selected':''}">${opt}</span>`
      ).join('');

      const sexVal = val('sex');
      const sexMale = `<span class="loc-option${sexVal==='Male'?' selected':''}">Male</span>`;
      const sexFemale = `<span class="loc-option${sexVal==='Female'?' selected':''}">Female</span>`;

      const witnessSig = fv.witness_signature || null;
      const sigHtml = witnessSig
        ? `<img src="${witnessSig}" style="max-height:20px;border-bottom:0.5px solid #666;margin-left:4px;vertical-align:bottom">`
        : `<span class="field-value" style="min-width:150px;display:inline-block">&nbsp;</span>`;

      const effRowsHtml = effectsRows.map(r =>
        `<tr>
          <td style="text-align:center">${r.itemNum}</td>
          <td>${r.qty||''}</td>
          <td>${r.description||''}</td>
          <td>${r.jewelry||''}</td>
          <td>${r.initials||''}</td>
        </tr>`
      ).join('');

      const noEffects = fv.no_personal_effects;
      const complianceBanner = `ALL STAT MCS TECHS HAVE GOVERNMENT-ISSUED TWIC CARDS &amp; ARE BACKGROUND CHECKED. STAT MCS IS FULLY INSURED &amp; BONDED. ALL TRANSPORTS COMPLY WITH STATE AND FEDERAL REGULATIONS.`;

      printDiv.innerHTML = `
        <style>
          @page { size: letter portrait; margin: 0.25in; }
          * { box-sizing: border-box; }
          @media print { body > *:not(#fcr-print-doc) { display: none !important; } #fcr-print-doc { display: block !important; } }
          body { margin: 0; padding: 0; }
          #fcr-print-doc { font-family: Arial, sans-serif; font-size: 7.5pt; line-height: 1.2; color: #111; max-width: 100%; padding: 0; zoom: 0.88; }
          .form-header { display: flex; justify-content: space-between; align-items: flex-start; border: 2px solid #333; padding: 3px 6px; }
          .form-header .logo-block { display: flex; align-items: flex-start; gap: 5px; }
          .form-header .logo-wings { font-size: 18pt; line-height: 1; color: #1a3a6b; }
          .form-header .company-name { font-size: 12pt; font-weight: bold; line-height: 1.2; }
          .form-header .company-sub { font-size: 7pt; color: #333; }
          .form-header .contact-info { font-size: 7pt; text-align: right; line-height: 1.4; }
          .form-header .control-num { margin-top: 2px; font-size: 7pt; }
          .form-section { border: 1px solid #333; border-bottom: none; padding: 2px 4px; page-break-inside: avoid; }
          .form-section.last { border-bottom: 1px solid #333; }
          .section-row { display: flex; gap: 6px; align-items: baseline; margin: 1px 0; flex-wrap: nowrap; }
          .field-label { font-size: 6.5pt; font-weight: bold; white-space: nowrap; }
          .field-value { border-bottom: 0.5px solid #666; min-width: 60px; flex: 1; font-size: 7.5pt; padding: 0 1px; display: inline-block; min-height: 11px; }
          .field-value.short { min-width: 30px; flex: none; }
          .yn-box { display: inline-block; border: 1px solid #333; width: 13px; height: 11px; text-align: center; font-size: 7pt; line-height: 11px; margin: 0 1px; font-weight: bold; }
          .yn-box.selected { background: #333; color: white; }
          .loc-option { display: inline-block; border: 1px solid #555; padding: 0 3px; margin: 0 1px; font-size: 6.5pt; }
          .loc-option.selected { background: #333; color: white; }
          .two-col { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #333; border-bottom: none; page-break-inside: avoid; }
          .two-col .left { padding: 2px 4px; border-right: 1px solid #333; }
          .two-col .right { padding: 2px 4px; }
          .two-col .left .section-row { margin: 0.5px 0; }
          .two-col .right .inj-row { display: flex; gap: 4px; align-items: baseline; margin: 0.5px 0; }
          .effects-table { width: 100%; border-collapse: collapse; }
          .effects-table th, .effects-table td { border: 1px solid #333; padding: 1px 2px; font-size: 6.5pt; height: 14px; }
          .effects-table th { background: #eee; font-weight: bold; text-align: center; }
          .effects-table td:first-child { text-align: center; width: 18px; }
          .effects-table td:nth-child(2) { width: 28px; }
          .effects-table td:nth-child(4) { width: 60px; }
          .effects-table td:nth-child(5) { width: 55px; }
          .compliance { font-size: 6pt; color: #777; text-align: center; border: 1px solid #333; border-bottom: none; padding: 2px 4px; white-space: nowrap; overflow: hidden; }
          .compliance.last { border-bottom: 1px solid #333; }
          .section-title { font-size: 6.5pt; font-weight: bold; text-transform: uppercase; margin-bottom: 1px; }
        </style>

        <!-- HEADER -->
        <div class="form-header">
          <div class="logo-block">
            <div class="logo-wings">🦅</div>
            <div>
              <div class="company-name">STAT MCS</div>
              <div class="company-sub">MEDICAL COURIER SERVICES</div>
              <div class="company-sub" style="font-weight:bold;margin-top:2px">FIRST CALL INTAKE</div>
            </div>
          </div>
          <div class="contact-info">
            <div><strong>Office:</strong> (281) 940-6525</div>
            <div>www.statmcs.com</div>
            <div>statmcs.com@gmail.com</div>
            <div class="control-num"><strong>Control #:</strong> <span class="field-value short">${val('control_number')}</span></div>
          </div>
        </div>

        <!-- COMPLIANCE BANNER -->
        <div class="compliance">${complianceBanner}</div>

        <!-- CLIENT / CODE / DATE -->
        <div class="form-section">
          <div class="section-row">
            <span class="field-label">Client:</span><span class="field-value">${val('client')}</span>
            <span class="field-label">Code:</span><span class="field-value short" style="width:70px">${val('code')}</span>
            <span class="field-label">Date:</span><span class="field-value short" style="width:90px">${val('date')}</span>
          </div>
        </div>

        <!-- VETERAN / FAMILY / DECOMP / ORGAN / ARRIVAL -->
        <div class="form-section">
          <div class="section-row">
            <span class="field-label">Veteran:</span> ${yn('veteran')}
            &nbsp;&nbsp;
            <span class="field-label">Family Present:</span> ${yn('family_present')}
            &nbsp;&nbsp;
            <span class="field-label">DeComp:</span> ${yn('decomp')}
            &nbsp;&nbsp;
            <span class="field-label">Organ Donor:</span> ${yn('organ_donor')}
          </div>
          <div class="section-row">
            <span class="field-label">Arrival Time:</span><span class="field-value short" style="width:80px">${val('arrival_time')}</span>
          </div>
        </div>

        <!-- LOCATION TYPE -->
        <div class="form-section">
          <div><span class="field-label">TYPE OF LOCATION:</span> ${locHtml}</div>
        </div>

        <!-- NAME OF DECEASED / SEX -->
        <div class="form-section">
          <div class="section-row">
            <span class="field-label">Name of Deceased:</span><span class="field-value">${val('decedent_name')}</span>
            &nbsp;&nbsp;
            <span class="field-label">Sex:</span> ${sexMale} ${sexFemale}
          </div>
        </div>

        <!-- LOCATION ADDRESS / FACILITY / PHONE / CONTACTS -->
        <div class="form-section">
          <div class="section-row">
            <span class="field-label">Location Address:</span><span class="field-value">${val('location_address')}</span>
            <span class="field-label">City:</span><span class="field-value short" style="width:100px">${val('location_city')}</span>
          </div>
          <div class="section-row">
            <span class="field-label">Facility Name:</span><span class="field-value">${val('facility_name')}</span>
            <span class="field-label">Remarks:</span><span class="field-value short" style="width:120px">${val('remarks')}</span>
          </div>
          <div class="section-row">
            <span class="field-label">Location Phone #:</span><span class="field-value short" style="width:140px">${val('location_phone')}</span>
          </div>
          <div class="section-row">
            <span class="field-label">Contact:</span><span class="field-value">${val('contact_primary')}</span>
            <span class="field-label">or</span>
            <span class="field-value">${val('contact_secondary')}</span>
          </div>
        </div>

        <!-- STAIRS/OBSTACLES -->
        <div class="form-section">
          <div class="section-row">
            <span class="field-label">Any Stairs/Obstacles:</span> ${yn('stairs_obstacles')}
            &nbsp;&nbsp;
            <span class="field-label">If Yes, WHAT?</span><span class="field-value">${val('stairs_details')}</span>
          </div>
        </div>

        <!-- DOB / DOD / AGE / TOD / WEIGHT -->
        <div class="form-section">
          <div class="section-row">
            <span class="field-label">DOB:</span><span class="field-value short" style="width:90px">${val('dob')}</span>
            <span class="field-label">DOD:</span><span class="field-value short" style="width:90px">${val('dod')}</span>
            <span class="field-label">Age:</span><span class="field-value short" style="width:50px">${val('age')}</span>
          </div>
          <div class="section-row">
            <span class="field-label">TOD:</span><span class="field-value short" style="width:80px">${val('tod')}</span>
            &nbsp;&nbsp;
            <span class="field-label">Weight:</span><span class="field-value short" style="width:60px">${val('weight')}</span>
            <span class="field-label">lbs</span>
          </div>
        </div>

        <!-- EXTRA TECH / AFTER HOURS / BODY BAG / ICE / ADMIN / AIRPORT -->
        <div class="form-section">
          <div class="section-row">
            <span class="field-label">Extra Tech:</span> ${yn('extra_tech')}
            &nbsp;
            <span class="field-label">After Hours:</span> ${yn('after_hours')}
            &nbsp;
            <span class="field-label">Body Bag:</span> ${yn('body_bag')}
            &nbsp;
            <span class="field-label">Ice:</span> ${yn('ice')}
          </div>
          <div class="section-row">
            <span class="field-label">Airport Charges $:</span><span class="field-value short" style="width:100px">${val('airport_charges')}</span>
          </div>
        </div>

        <!-- TWO-COLUMN: NOK + INJURIES -->
        <div class="two-col">
          <div class="left">
            <div class="section-row"><span class="field-label">Name of NOK:</span><span class="field-value">${val('nok_name')}</span></div>
            <div class="section-row"><span class="field-label">Phone # NOK:</span><span class="field-value">${val('nok_phone')}</span></div>
            <div class="section-row"><span class="field-label">Relationship:</span><span class="field-value">${val('nok_relationship')}</span></div>
            <div class="section-row"><span class="field-label">Email of NOK:</span><span class="field-value">${val('nok_email')}</span></div>
            <div style="margin:2px 0 1px"><hr style="border:none;border-top:0.5px solid #ccc"></div>
            <div class="section-row"><span class="field-label">Doctor signing DC:</span><span class="field-value">${val('doctor_name')}</span></div>
            <div class="section-row"><span class="field-label">DR. Phone #:</span><span class="field-value">${val('doctor_phone')}</span></div>
            <div class="section-row"><span class="field-label">Releasing Authority:</span><span class="field-value">${val('releasing_authority')}</span></div>
            <div class="section-row"><span class="field-label">ID Anklet Applied By:</span><span class="field-value">${val('id_anklet_applied_by')}</span></div>
            <div style="margin-top:2px;font-size:7pt">${noEffects ? '☑' : '☐'} <strong>NO PERSONAL EFFECTS</strong></div>
          </div>
          <div class="right">
            <div class="section-title">Any Noticeable Injuries:</div>
            <div class="inj-row"><span class="field-label">Blood:</span> ${yn('injury_blood')} &nbsp; <span class="field-label">Bruising:</span> ${yn('injury_bruising')}</div>
            <div class="inj-row"><span class="field-label">Burn:</span> ${yn('injury_burn')} &nbsp; <span class="field-label">Cuts:</span> ${yn('injury_cuts')}</div>
            <div class="inj-row"><span class="field-label">Discolored:</span> ${yn('injury_discolored')}</div>
            <div class="inj-row"><span class="field-label">Head Injury:</span> ${yn('injury_head')}</div>
            <div class="inj-row"><span class="field-label">Recent Scar:</span> ${yn('injury_scar')}</div>
            <div class="inj-row"><span class="field-label">Scrapes:</span> ${yn('injury_scrapes')}</div>
            <div style="margin-top:2px">
              <div class="field-label" style="margin-bottom:1px">NOTES:</div>
              <div class="field-value" style="min-height:18px;min-width:unset;width:100%;display:block">${val('notes')}</div>
            </div>
            <div style="margin-top:2px">
              <div class="section-row"><span class="field-label">Invoice #:</span><span class="field-value">${val('invoice_number')}</span></div>
              <div class="section-row"><span class="field-label">TOTAL: $</span><span class="field-value">${val('total')}</span></div>
            </div>
          </div>
        </div>

        <!-- PERSONAL EFFECTS INVENTORY -->
        <div class="form-section">
          <div class="section-title">Personal Effects Inventory</div>
          <table class="effects-table">
            <thead>
              <tr>
                <th>#</th><th>Qty</th><th>Clothing/Item Description</th><th>Jewelry</th><th>Witness Init</th>
              </tr>
            </thead>
            <tbody>${effRowsHtml}</tbody>
          </table>
        </div>

        <!-- REMAINS DELIVERED TO -->
        <div class="form-section">
          <div class="section-row">
            <span class="field-label">Remains Delivered To:</span><span class="field-value">${val('delivered_to')}</span>
            <span class="field-label">Address:</span><span class="field-value">${val('delivery_address')}</span>
          </div>
          <div class="section-row">
            <span class="field-label">City:</span><span class="field-value">${val('delivery_city')}</span>
            <span class="field-label">Code:</span><span class="field-value short" style="width:80px">${val('code')}</span>
          </div>
        </div>

        <!-- TECHNICIAN / DATES / TIMES / SIGNATURE -->
        <div class="form-section">
          <div class="section-row">
            <span class="field-label">STAT MCS Technician:</span><span class="field-value">${val('technician_name')}</span>
            <span class="field-label">Date:</span><span class="field-value short" style="width:90px">${val('sign_date')}</span>
          </div>
          <div class="section-row">
            <span class="field-label">Leave Time:</span><span class="field-value short" style="width:80px">${val('leave_time')}</span>
            &nbsp;&nbsp;
            <span class="field-label">Funeral Home Time:</span><span class="field-value short" style="width:80px">${val('funeral_home_time')}</span>
          </div>
          <div class="section-row" style="margin-top:1px">
            <span class="field-label">Witness Signature: X</span>
            ${sigHtml}
          </div>
          <div class="section-row">
            <span class="field-label">Print Name:</span><span class="field-value">${val('print_name')}</span>
            <span class="field-label">Loaded Miles:</span><span class="field-value short" style="width:60px">${val('loaded_miles')}</span>
          </div>
        </div>

        <!-- COMPLIANCE FOOTER -->
        <div class="compliance last">${complianceBanner}</div>
      `;

      document.body.appendChild(printDiv);
      window.print();
      setTimeout(() => document.body.removeChild(printDiv), 500);
      return;
    }

    // ── Generic field list for all other templates ──────────────────────
    const renderFieldHtml = (f) => {
      if (typeof f === 'string') {
        // Legacy string field
        if (f === 'signature') return `<div class="field-row"><div class="field-label">Signature</div>${signatureData ? `<img src="${signatureData}" class="sig-img" style="height:80px;" />` : '<div class="field-value"></div>'}</div>`;
        const label = f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        return `<div class="field-row"><div class="field-label">${label}</div><div class="field-value">${fieldValues[f] || ''}</div></div>`;
      }
      // New object field
      const val = fieldValues[f.id] || '';
      if (f.type === 'signature') {
        const sig = f.id === 'witness_signature' ? (fieldValues.witness_signature || null) : signatureData;
        return `<div class="field-row"><div class="field-label">${f.label}</div>${sig ? `<img src="${sig}" class="sig-img" style="height:80px;" />` : '<div class="field-value"></div>'}</div>`;
      }
      if (f.type === 'yn') {
        return `<div class="field-row"><div class="field-label">${f.label}</div><div class="field-value">${val === 'Y' ? '☑ Yes' : val === 'N' ? '☑ No' : '☐ Yes  ☐ No'}</div></div>`;
      }
      if (f.type === 'checkbox') {
        return `<div class="field-row"><div class="field-label">${f.label}</div><div class="field-value">${val ? '☑ Checked' : '☐'}</div></div>`;
      }
      if (f.type === 'effects_table') {
        const rowsHtml = effectsRows.map(r =>
          `<tr><td style="padding:4px 8px;border:1px solid #ccc;text-align:center">${r.itemNum}</td><td style="padding:4px 8px;border:1px solid #ccc">${r.qty}</td><td style="padding:4px 8px;border:1px solid #ccc">${r.description}</td><td style="padding:4px 8px;border:1px solid #ccc">${r.jewelry}</td><td style="padding:4px 8px;border:1px solid #ccc">${r.initials}</td></tr>`
        ).join('');
        return `<div class="field-row"><div class="field-label">${f.label}</div><table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:4px"><thead><tr><th style="padding:4px 8px;border:1px solid #ccc;background:#f5f5f5">Item #</th><th style="padding:4px 8px;border:1px solid #ccc;background:#f5f5f5">Qty</th><th style="padding:4px 8px;border:1px solid #ccc;background:#f5f5f5">Clothing/Item Description</th><th style="padding:4px 8px;border:1px solid #ccc;background:#f5f5f5">Jewelry</th><th style="padding:4px 8px;border:1px solid #ccc;background:#f5f5f5">Witness Initials</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
      }
      if (f.type === 'currency') {
        return `<div class="field-row"><div class="field-label">${f.label}</div><div class="field-value">$${val}</div></div>`;
      }
      return `<div class="field-row"><div class="field-label">${f.label}</div><div class="field-value">${val}</div></div>`;
    };

    const headerHtml = tpl.printHeader ? `<div style="font-size:11px;color:#555;text-align:center;margin-bottom:16px;padding:8px;background:#f8f8f8;border-radius:4px">${tpl.printHeader}</div>` : '';

    printDiv.innerHTML = `
      <style>
        @page { size: letter portrait; margin: 0.35in; }
        @media print { body > *:not(#fcr-print-doc) { display: none !important; } #fcr-print-doc { display: block !important; } }
        #fcr-print-doc { font-family: Arial, sans-serif; max-width: 100%; margin: 0; padding: 0; zoom: 0.82; }
        #fcr-print-doc h1 { font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 6px; margin-bottom: 6px; }
        #fcr-print-doc .field-row { margin-bottom: 8px; page-break-inside: avoid; }
        #fcr-print-doc .field-label { font-size: 8px; font-weight: bold; text-transform: uppercase; color: #555; margin-bottom: 2px; }
        #fcr-print-doc .field-value { font-size: 11px; border-bottom: 1px solid #ccc; padding: 2px 0; min-height: 18px; }
        #fcr-print-doc .sig-img { border: 1px solid #999; border-radius: 4px; max-height: 60px; }
      </style>
      <h1>${tpl.name}</h1>
      ${headerHtml}
      ${tpl.fields.map(renderFieldHtml).join('')}
    `;
    document.body.appendChild(printDiv);
    window.print();
    setTimeout(() => document.body.removeChild(printDiv), 500);
  };

  const currentTpl = templates.find(tp => tp.id === selectedTpl);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <FileText className="w-5 h-5 text-gray-500" />
        <h2 className="text-lg font-semibold">Documents</h2>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button onClick={() => setSection('templates')}
          className={`py-2 px-4 text-sm font-medium border-b-2 -mb-px ${section === 'templates' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          📋 Templates
        </button>
        <button onClick={() => setSection('fill')}
          className={`py-2 px-4 text-sm font-medium border-b-2 -mb-px ${section === 'fill' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          ✍️ Fill a Document
        </button>
      </div>

      {/* ── Templates Section ─────────────────────────────────────────── */}
      {section === 'templates' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <label className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium cursor-pointer">
              <Upload className="w-4 h-4" /> Upload Template
              <input type="file" accept=".pdf,image/*" className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = ev => {
                    const newTpl = {
                      id: 'tpl-' + Date.now(),
                      name: file.name.replace(/\.[^.]+$/, ''),
                      base64: ev.target.result,
                      fields: ['decedent_name', 'signature', 'date_signed'],
                    };
                    const updated = [...templates, newTpl];
                    setTemplates(updated);
                    saveTemplates(updated);
                  };
                  reader.readAsDataURL(file);
                  e.target.value = '';
                }} />
            </label>
          </div>
          <div className="space-y-2">
            {templates.map(tpl => {
              const fieldCount = tpl.fields.length;
              const previewNames = tpl.fields.slice(0, 4).map(f => typeof f === 'string' ? f.replace(/_/g, ' ') : f.label).join(', ');
              return (
                <div key={tpl.id} className={`bg-white rounded-lg border p-4 flex items-center justify-between ${tpl.id === 'stat-mcs-first-call' ? 'border-blue-300 ring-1 ring-blue-200' : 'border-gray-200'}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{tpl.name}</p>
                      {tpl.id === 'stat-mcs-first-call' && <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full">Primary</span>}
                    </div>
                    {tpl.description && <p className="text-xs text-gray-500 mt-0.5">{tpl.description}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{fieldCount} fields: {previewNames}{fieldCount > 4 ? '...' : ''}</p>
                  </div>
                  <button
                    onClick={() => { setSelectedTpl(tpl.id); setSection('fill'); setFieldValues({}); setSignatureData(null); }}
                    className="text-sm bg-gray-100 text-gray-700 hover:bg-blue-50 hover:text-blue-600 px-3 py-1.5 rounded-lg font-medium"
                  >
                    Fill →
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Fill Section ──────────────────────────────────────────────── */}
      {section === 'fill' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Template</label>
              <select value={selectedTpl} onChange={e => { setSelectedTpl(e.target.value); setFieldValues({}); setSignatureData(null); }}
                className="w-full p-2 border border-gray-300 rounded text-sm">
                <option value="">— Select template —</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Auto-fill from Transport
                {savedDocsCount !== null && (
                  <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                    📎 {savedDocsCount} saved
                  </span>
                )}
              </label>
              <select value={selectedTransport} onChange={e => setSelectedTransport(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded text-sm">
                <option value="">— Select transport —</option>
                {transports.filter(t => t.status !== 'Completed').map(t => (
                  <option key={t.id} value={t.id}>{t.decedentName || t.id} — {t.status}</option>
                ))}
                {transports.filter(t => t.status === 'Completed').slice(0, 10).map(t => (
                  <option key={t.id} value={t.id}>{t.decedentName || t.id} (Completed)</option>
                ))}
              </select>
            </div>
          </div>

          {currentTpl && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
              <div>
                <h3 className="font-semibold text-gray-800">{currentTpl.name}</h3>
                {currentTpl.printHeader && <p className="text-xs text-gray-500 mt-1">{currentTpl.printHeader}</p>}
              </div>
              {currentTpl.fields.map(field => {
                // ── Legacy string fields ──────────────────────────────
                if (typeof field === 'string') {
                  if (field === 'signature') return (
                    <div key="signature">
                      <label className="block text-sm font-medium text-gray-600 mb-1">Signature</label>
                      <canvas
                        ref={canvasRef}
                        width={400} height={150}
                        className="border-2 border-gray-300 rounded-lg bg-white w-full touch-none"
                        style={{ maxWidth: '100%', cursor: 'crosshair' }}
                      />
                      <div className="flex gap-2 mt-1">
                        <button onClick={clearSignature} className="text-xs text-gray-500 hover:text-red-600 px-2 py-1 border border-gray-200 rounded">Clear</button>
                        {signatureData && <span className="text-xs text-green-600 py-1">✓ Signature saved</span>}
                      </div>
                    </div>
                  );
                  const label = field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                  return (
                    <div key={field}>
                      <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>
                      <input type="text" value={fieldValues[field] || ''}
                        onChange={e => setFieldValues(prev => ({ ...prev, [field]: e.target.value }))}
                        className="w-full p-2 border border-gray-300 rounded text-sm" placeholder={label} />
                    </div>
                  );
                }

                // ── New rich object fields ────────────────────────────
                const { id, label, type, options } = field;
                const val = fieldValues[id] || '';

                if (type === 'yn') return (
                  <div key={id}>
                    <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>
                    <div className="flex gap-2">
                      {['Y', 'N'].map(opt => (
                        <button key={opt}
                          onClick={() => setFieldValues(prev => ({ ...prev, [id]: prev[id] === opt ? '' : opt }))}
                          className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${val === opt ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'}`}>
                          {opt === 'Y' ? 'Yes' : 'No'}
                        </button>
                      ))}
                    </div>
                  </div>
                );

                if (type === 'checkbox') return (
                  <div key={id} className="flex items-center gap-2">
                    <input type="checkbox" id={`chk-${id}`} checked={!!val}
                      onChange={e => setFieldValues(prev => ({ ...prev, [id]: e.target.checked }))}
                      className="w-4 h-4 rounded border-gray-300" />
                    <label htmlFor={`chk-${id}`} className="text-sm font-medium text-gray-700">{label}</label>
                  </div>
                );

                if (type === 'select') return (
                  <div key={id}>
                    <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>
                    <select value={val} onChange={e => setFieldValues(prev => ({ ...prev, [id]: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded text-sm">
                      <option value="">— Select —</option>
                      {(options || []).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                );

                if (type === 'textarea') return (
                  <div key={id}>
                    <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>
                    <textarea value={val} onChange={e => setFieldValues(prev => ({ ...prev, [id]: e.target.value }))}
                      rows={3} className="w-full p-2 border border-gray-300 rounded text-sm" placeholder={label} />
                  </div>
                );

                if (type === 'currency') return (
                  <div key={id}>
                    <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>
                    <div className="flex items-center border border-gray-300 rounded overflow-hidden">
                      <span className="px-2 py-2 bg-gray-50 text-gray-500 text-sm border-r border-gray-300">$</span>
                      <input type="text" value={val} onChange={e => setFieldValues(prev => ({ ...prev, [id]: e.target.value }))}
                        className="flex-1 p-2 text-sm outline-none" placeholder="0.00" />
                    </div>
                  </div>
                );

                if (type === 'signature') {
                  const isWitness = id === 'witness_signature';
                  const sigData = isWitness ? fieldValues.witness_signature : signatureData;
                  return (
                    <div key={id}>
                      <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>
                      <canvas
                        ref={isWitness ? witnessCanvasRef : canvasRef}
                        width={400} height={120}
                        className="border-2 border-gray-300 rounded-lg bg-white w-full touch-none"
                        style={{ maxWidth: '100%', cursor: 'crosshair' }}
                      />
                      <div className="flex gap-2 mt-1">
                        <button onClick={isWitness ? clearWitnessSignature : clearSignature}
                          className="text-xs text-gray-500 hover:text-red-600 px-2 py-1 border border-gray-200 rounded">Clear</button>
                        {sigData && <span className="text-xs text-green-600 py-1">✓ Signature saved</span>}
                      </div>
                    </div>
                  );
                }

                if (type === 'effects_table') return (
                  <div key={id}>
                    <label className="block text-sm font-medium text-gray-600 mb-2">{label}</label>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-gray-300 px-2 py-1 text-center w-10">Item #</th>
                            <th className="border border-gray-300 px-2 py-1 w-14">Qty</th>
                            <th className="border border-gray-300 px-2 py-1">Clothing/Item Description</th>
                            <th className="border border-gray-300 px-2 py-1">Jewelry</th>
                            <th className="border border-gray-300 px-2 py-1 w-20">Witness Initials</th>
                          </tr>
                        </thead>
                        <tbody>
                          {effectsRows.map((row, i) => (
                            <tr key={i}>
                              <td className="border border-gray-300 px-2 py-1 text-center text-gray-500">{row.itemNum}</td>
                              <td className="border border-gray-300 p-0">
                                <input type="number" value={row.qty}
                                  onChange={e => setEffectsRows(prev => prev.map((r, ri) => ri === i ? { ...r, qty: e.target.value } : r))}
                                  className="w-full p-1 outline-none text-center" min="0" />
                              </td>
                              <td className="border border-gray-300 p-0">
                                <input type="text" value={row.description}
                                  onChange={e => setEffectsRows(prev => prev.map((r, ri) => ri === i ? { ...r, description: e.target.value } : r))}
                                  className="w-full p-1 outline-none" />
                              </td>
                              <td className="border border-gray-300 p-0">
                                <input type="text" value={row.jewelry}
                                  onChange={e => setEffectsRows(prev => prev.map((r, ri) => ri === i ? { ...r, jewelry: e.target.value } : r))}
                                  className="w-full p-1 outline-none" />
                              </td>
                              <td className="border border-gray-300 p-0">
                                <input type="text" value={row.initials} maxLength={6}
                                  onChange={e => setEffectsRows(prev => prev.map((r, ri) => ri === i ? { ...r, initials: e.target.value } : r))}
                                  className="w-full p-1 outline-none text-center" />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );

                // Default: text/number/date/time/tel/email
                return (
                  <div key={id}>
                    <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>
                    <input
                      type={type === 'tel' ? 'tel' : type === 'email' ? 'email' : type === 'number' ? 'number' : type === 'date' ? 'date' : type === 'time' ? 'time' : 'text'}
                      value={val}
                      onChange={e => setFieldValues(prev => ({ ...prev, [id]: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded text-sm"
                      placeholder={label}
                    />
                  </div>
                );
              })}
              {saveStatus && (
                <div className={`text-sm px-3 py-2 rounded-lg ${saveStatus === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : saveStatus === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                  {saveStatus === 'saving' ? '⏳ Saving...' : saveMessage}
                </div>
              )}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleSaveToTransport}
                  disabled={saveStatus === 'saving'}
                  className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  💾 Save to Transport
                </button>
                <button
                  onClick={handlePrint}
                  className="flex-1 bg-gray-900 text-white py-2.5 rounded-lg font-medium hover:bg-gray-800 flex items-center justify-center gap-2"
                >
                  🖨️ Print / PDF
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Admin Users View ─────────────────────────────────────────────────────────

const AdminUsersView = ({ adminUsersData, adminUsersLoading, adminUsersSearch, setAdminUsersSearch, onLoadUsers }) => {
  useEffect(() => { if (!adminUsersData) onLoadUsers(); }, []);

  if (adminUsersLoading) return <div className="text-center py-8 text-gray-500"><Loader className="w-6 h-6 animate-spin mx-auto mb-2" />Loading users...</div>;
  if (!adminUsersData) return <div className="text-center py-8 text-gray-400">No data</div>;

  const { staff, byHome } = adminUsersData;
  const q = adminUsersSearch.toLowerCase();

  const matchUser = u => !q || u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.funeral_home_name?.toLowerCase().includes(q);

  const RoleBadge = ({ role }) => (
    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
      role === 'admin' ? 'bg-red-100 text-red-700' :
      role === 'employee' ? 'bg-blue-100 text-blue-700' :
      'bg-green-100 text-green-700'
    }`}>{role}</span>
  );

  const UserRow = ({ u }) => (
    <div className="flex items-center gap-3 text-sm py-2 border-b border-gray-50 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{u.username}</span>
          <RoleBadge role={u.role} />
          {u.email_verified === 0 && <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Unverified</span>}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">{u.email || '—'} · Joined {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</div>
      </div>
    </div>
  );

  const filteredStaff = staff.filter(matchUser);
  const filteredHomes = Object.entries(byHome).map(([key, data]) => ({
    key, ...data, users: data.users.filter(matchUser)
  })).filter(h => h.users.length > 0 || !q);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={adminUsersSearch}
          onChange={e => setAdminUsersSearch(e.target.value)}
          placeholder="Search users or funeral homes..."
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
      </div>

      {/* Staff section */}
      {filteredStaff.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-gray-500" />
            <h3 className="font-semibold text-gray-800">Staff</h3>
            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{filteredStaff.length}</span>
          </div>
          {filteredStaff.map(u => <UserRow key={u.id} u={u} />)}
        </div>
      )}

      {/* By funeral home */}
      {filteredHomes.filter(h => h.key !== '__unassigned__').map(home => (
        <div key={home.key} className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-gray-400" />
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-gray-800">{home.name}</span>
              {(home.city || home.state) && <span className="text-xs text-gray-400 ml-2">{[home.city, home.state].filter(Boolean).join(', ')}</span>}
            </div>
            <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">{home.users.length} users</span>
          </div>
          {home.users.map(u => <UserRow key={u.id} u={u} />)}
        </div>
      ))}

      {/* Unassigned */}
      {filteredHomes.filter(h => h.key === '__unassigned__').map(home => home.users.length > 0 && (
        <div key="unassigned" className="bg-amber-50 rounded-lg border border-amber-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <h3 className="font-semibold text-amber-800">Unassigned (no funeral home matched)</h3>
            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{home.users.length}</span>
          </div>
          {home.users.map(u => <UserRow key={u.id} u={u} />)}
        </div>
      ))}

      <div className="text-right">
        <button onClick={onLoadUsers} className="text-xs text-gray-400 hover:text-gray-600">↻ Refresh</button>
      </div>
    </div>
  );
};

// ─── Helper components ────────────────────────────────────────────────────────

const TabBtn = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`flex-shrink-0 py-3 px-4 text-center font-medium text-sm ${active ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
  >
    {children}
  </button>
);

const FormField = ({ label, children, confidence }) => (
  <div>
    <div className="flex items-center gap-2 mb-1">
      <label className="block text-sm font-medium text-gray-600">{label}</label>
      {confidence && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
          confidence === 'high' ? 'bg-green-100 text-green-700' :
          confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
          'bg-orange-100 text-orange-700'
        }`}>AI {confidence}</span>
      )}
    </div>
    {children}
  </div>
);

// Transport card for funeral home "My Transports" view
const TransportCard = ({ transport, onSaveNotes, onCopyCase, copiedId, currentUser }) => {
  const [notesInput, setNotesInput] = useState(transport.notes || '');
  const [editingNotes, setEditingNotes] = useState(false);
  const [attachments, setAttachments] = useState(null); // null=not loaded, []= loaded
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [emailForms, setEmailForms] = useState({}); // aid -> { to, subject, message, open }
  const fileInputRef = useRef(null);

  const loadAttachments = async () => {
    if (attachmentsLoading) return;
    setAttachmentsLoading(true);
    try {
      const data = await apiRequest('GET', `/transports/${transport.id}/attachments`);
      setAttachments(data.attachments || []);
    } catch (_) {
      setAttachments([]);
    } finally {
      setAttachmentsLoading(false);
    }
  };

  useEffect(() => { loadAttachments(); }, [transport.id]);

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || !files.length) return;
    for (const file of files) {
      const fd = new FormData();
      fd.append('file', file);
      try {
        await apiUpload(`/transports/${transport.id}/attachments`, fd);
      } catch (err) {
        console.error('Upload error:', err.message);
      }
    }
    e.target.value = '';
    loadAttachments();
  };

  const handleDeleteAttachment = async (aid) => {
    if (!confirm('Delete this attachment?')) return;
    try {
      await apiRequest('DELETE', `/transports/${transport.id}/attachments/${aid}`);
      setAttachments(prev => prev.filter(a => a.id !== aid));
    } catch (err) { alert(err.message); }
  };

  const handleEmailAttachment = async (aid) => {
    const form = emailForms[aid] || {};
    if (!form.to) return alert('Enter recipient email');
    try {
      await apiRequest('POST', `/transports/${transport.id}/attachments/${aid}/email`, {
        to: form.to, subject: form.subject, message: form.message
      });
      alert('Email sent!');
      setEmailForms(prev => ({ ...prev, [aid]: { ...prev[aid], open: false } }));
    } catch (err) { alert(err.message); }
  };

  const fmtSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono text-gray-500">#{transport.id}</span>
            {transport.caseNumber && (
              <button
                onClick={() => onCopyCase?.(transport.caseNumber, transport.id)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors"
                title="Copy case number"
              >
                {copiedId === transport.id ? (
                  <span className="text-green-600 font-medium">Copied!</span>
                ) : (
                  <>📋 {transport.caseNumber}</>
                )}
              </button>
            )}
          </div>
          <h3 className="font-semibold text-gray-900">{transport.decedentName}</h3>
          <p className="text-sm text-gray-600">{transport.funeralHomeName}</p>
          {transport.scheduledPickupAt && (
            <p className="text-xs text-indigo-600 mt-0.5 flex items-center gap-1">
              ⏰ Scheduled: {new Date(transport.scheduledPickupAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          )}
        </div>
        <div className="text-right">
          <StatusBadge status={transport.status} />
          <p className="text-sm font-semibold text-gray-900 mt-1">${transport.totalCost?.toFixed(2)}</p>
        </div>
      </div>

      {/* Status Timeline */}
      <StatusTimeline transport={transport} />

      <div className="grid grid-cols-1 gap-2 text-sm mt-3">
        <div className="flex items-center">
          <MapPin className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
          <span className="text-gray-600 truncate">
            {transport.pickupLocation} ({transport.pickupLocationType}) → {transport.destination}
          </span>
        </div>
        <div className="flex items-center">
          <User className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
          <span>Case: {transport.caseNumber} • {transport.weight} lbs</span>
        </div>
        {transport.eta && (
          <div className="flex items-center">
            <Clock className="w-4 h-4 text-indigo-500 mr-2 flex-shrink-0" />
            <span className="text-indigo-700 font-medium">ETA: {transport.eta}</span>
          </div>
        )}
      </div>

      {/* Driver & Vehicle Section */}
      <div className={`mt-3 rounded-lg p-3 border ${transport.assignedDriver ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-200'}`}>
        <h4 className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
          <Truck className="w-3 h-3" /> Driver &amp; Vehicle
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${transport.assignedDriver ? 'bg-blue-200' : 'bg-gray-200'}`}>
              <User className={`w-4 h-4 ${transport.assignedDriver ? 'text-blue-700' : 'text-gray-400'}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Driver</p>
              <p className={`text-sm font-medium truncate ${transport.assignedDriver ? 'text-gray-900' : 'text-gray-400 italic'}`}>
                {transport.assignedDriver || 'Awaiting assignment'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${transport.assignedVehicle ? 'bg-indigo-200' : 'bg-gray-200'}`}>
              <Truck className={`w-4 h-4 ${transport.assignedVehicle ? 'text-indigo-700' : 'text-gray-400'}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Vehicle</p>
              <p className={`text-sm font-medium truncate ${transport.assignedVehicle ? 'text-gray-900' : 'text-gray-400 italic'}`}>
                {transport.assignedVehicle || 'Awaiting assignment'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cost Breakdown */}
      {transport.costBreakdown && (
        <div className="bg-gray-50 p-3 rounded text-sm mt-3">
          <h4 className="font-medium mb-1">Cost Breakdown</h4>
          <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
            <div>Pickup Fee: ${transport.costBreakdown.pickupFee}</div>
            {transport.costBreakdown.mileageFee > 0 && <div>Mileage: ${transport.costBreakdown.mileageFee?.toFixed(2)}</div>}
            {transport.costBreakdown.obFee > 0 && <div>OB Fee: ${transport.costBreakdown.obFee}</div>}
            <div>Admin Fee: ${transport.costBreakdown.adminFee}</div>
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="mt-3 pt-3 border-t">
        {editingNotes ? (
          <div className="space-y-2">
            <textarea
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              className="w-full text-sm p-2 border border-gray-300 rounded"
              rows={2}
              placeholder="Add notes..."
            />
            <div className="flex gap-2">
              <button
                onClick={() => { onSaveNotes(transport.id, notesInput); setEditingNotes(false); }}
                className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
              >Save</button>
              <button onClick={() => setEditingNotes(false)} className="text-xs text-gray-500 px-3 py-1">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 italic">{transport.notes || 'No notes'}</span>
            <button onClick={() => setEditingNotes(true)} className="text-xs text-blue-600 hover:underline">Edit notes</button>
          </div>
        )}
      </div>

      {/* Attachments Section */}
      <div className="mt-3 pt-3 border-t">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-600 flex items-center gap-1">
            <Paperclip className="w-3 h-3" /> Attachments {attachments ? `(${attachments.length})` : ''}
          </span>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded"
          >
            <Upload className="w-3 h-3" /> Upload
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
        </div>
        {attachmentsLoading && <p className="text-xs text-gray-400">Loading...</p>}
        {attachments && attachments.length === 0 && <p className="text-xs text-gray-400 italic">No attachments</p>}
        {attachments && attachments.map(att => (
          <div key={att.id} className="border border-gray-100 rounded p-2 mb-1 bg-gray-50">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1 min-w-0">
                <FileText className="w-3 h-3 text-gray-400 flex-shrink-0" />
                <span className="text-xs text-gray-800 truncate">{att.original_name}</span>
                {att.file_size && <span className="text-xs text-gray-400 flex-shrink-0">({fmtSize(att.file_size)})</span>}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <a
                  href={`/api/transports/${transport.id}/attachments/${att.id}/download`}
                  target="_blank" rel="noopener noreferrer"
                  className="p-1 text-gray-400 hover:text-blue-600" title="Download"
                >
                  <Download className="w-3 h-3" />
                </a>
                <button
                  onClick={() => window.open(`/api/transports/${transport.id}/attachments/${att.id}/download`, '_blank')}
                  className="p-1 text-gray-400 hover:text-blue-600" title="Print"
                >
                  <Printer className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setEmailForms(prev => ({ ...prev, [att.id]: { ...(prev[att.id] || {}), open: !prev[att.id]?.open } }))}
                  className="p-1 text-gray-400 hover:text-blue-600" title="Email"
                >
                  <Mail className="w-3 h-3" />
                </button>
                {currentUser?.role === 'admin' && (
                  <button onClick={() => handleDeleteAttachment(att.id)} className="p-1 text-gray-400 hover:text-red-600" title="Delete">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {att.uploaded_by} · {att.uploaded_at ? new Date(att.uploaded_at).toLocaleDateString() : ''}
            </div>
            {emailForms[att.id]?.open && (
              <div className="mt-2 space-y-1">
                <input
                  type="email" placeholder="To email"
                  className="w-full text-xs p-1.5 border border-gray-300 rounded"
                  value={emailForms[att.id]?.to || ''}
                  onChange={e => setEmailForms(prev => ({ ...prev, [att.id]: { ...prev[att.id], to: e.target.value } }))}
                />
                <input
                  type="text" placeholder="Subject"
                  className="w-full text-xs p-1.5 border border-gray-300 rounded"
                  value={emailForms[att.id]?.subject || ''}
                  onChange={e => setEmailForms(prev => ({ ...prev, [att.id]: { ...prev[att.id], subject: e.target.value } }))}
                />
                <textarea
                  placeholder="Message (optional)"
                  rows={2}
                  className="w-full text-xs p-1.5 border border-gray-300 rounded"
                  value={emailForms[att.id]?.message || ''}
                  onChange={e => setEmailForms(prev => ({ ...prev, [att.id]: { ...prev[att.id], message: e.target.value } }))}
                />
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEmailAttachment(att.id)}
                    className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                  >Send</button>
                  <button
                    onClick={() => setEmailForms(prev => ({ ...prev, [att.id]: { ...prev[att.id], open: false } }))}
                    className="text-xs text-gray-500 px-2 py-1"
                  >Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Per-transport chat */}
      <TransportChat transportId={transport.id} currentUser={currentUser} />
    </div>
  );
};

// ─── Vault Tab (Funeral Home) ─────────────────────────────────────────────────

const VaultTab = ({ transports, currentUser }) => {
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [vaultAttachments, setVaultAttachments] = useState({});
  const [emailForms, setEmailForms] = useState({});

  const sorted = [...transports].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const filtered = sorted.filter(t => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (t.decedentName || '').toLowerCase().includes(q) || (t.caseNumber || '').toLowerCase().includes(q);
  });

  const toggleExpand = async (id) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!vaultAttachments[id]) {
      try {
        const data = await apiRequest('GET', `/transports/${id}/attachments`);
        setVaultAttachments(prev => ({ ...prev, [id]: data.attachments || [] }));
      } catch (_) {
        setVaultAttachments(prev => ({ ...prev, [id]: [] }));
      }
    }
  };

  const handleEmailAtt = async (transportId, attId) => {
    const form = emailForms[attId] || {};
    if (!form.to) return alert('Enter recipient email');
    try {
      await apiRequest('POST', `/transports/${transportId}/attachments/${attId}/email`, {
        to: form.to, subject: form.subject, message: form.message
      });
      alert('Email sent!');
      setEmailForms(prev => ({ ...prev, [attId]: { ...prev[attId], open: false } }));
    } catch (err) { alert(err.message); }
  };

  const fmtSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">🔒 Call Vault</h2>
        <span className="text-sm text-gray-500">{filtered.length} call{filtered.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by decedent name or case #..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
      </div>
      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <History className="w-10 h-10 mx-auto mb-2" />
          <p>No transports found</p>
        </div>
      )}
      <div className="space-y-2">
        {filtered.map(t => {
          const isOpen = expandedId === t.id;
          const atts = vaultAttachments[t.id] || [];
          return (
            <div key={t.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <button
                className="w-full text-left p-3 hover:bg-gray-50 transition-colors"
                onClick={() => toggleExpand(t.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusBadge status={t.status} />
                    <span className="font-medium text-gray-900 truncate">{t.decedentName || '—'}</span>
                    <span className="text-xs text-gray-400 font-mono flex-shrink-0">#{t.caseNumber || t.id}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 flex-shrink-0">
                    <span className="hidden sm:inline">{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}</span>
                    <span className="font-semibold text-gray-700">${parseFloat(t.totalCost || 0).toFixed(2)}</span>
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {t.pickupLocation} → {t.destination}
                </div>
              </button>
              {isOpen && (
                <div className="border-t p-3 bg-gray-50 space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-gray-500">Decedent:</span> <span className="font-medium">{t.decedentName}</span></div>
                    <div><span className="text-gray-500">Date:</span> <span>{t.date}</span></div>
                    <div><span className="text-gray-500">Pickup:</span> <span>{t.pickupLocation}</span></div>
                    <div><span className="text-gray-500">Type:</span> <span>{t.pickupLocationType}</span></div>
                    <div><span className="text-gray-500">Destination:</span> <span>{t.destination}</span></div>
                    <div><span className="text-gray-500">Weight:</span> <span>{t.weight} lbs</span></div>
                    <div><span className="text-gray-500">Pickup Contact:</span> <span>{t.pickupContact || '—'}</span></div>
                    <div><span className="text-gray-500">Pickup Phone:</span> <span>{t.pickupPhone || '—'}</span></div>
                    <div><span className="text-gray-500">Driver:</span> <span>{t.assignedDriver || '—'}</span></div>
                    <div><span className="text-gray-500">Miles:</span> <span>{t.actualMiles || t.estimatedMiles}</span></div>
                  </div>
                  {t.notes && <p className="text-xs text-gray-600 italic">Notes: {t.notes}</p>}

                  {/* Summary PDF */}
                  <button
                    onClick={() => openAuthPdf(`/transports/${t.id}/summary.pdf`)}
                    className="inline-flex items-center gap-1 text-xs bg-gray-800 text-white px-3 py-1.5 rounded hover:bg-gray-700"
                  >
                    <FileText className="w-3 h-3" /> 📄 Summary PDF
                  </button>

                  {/* Attachments */}
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                      <Paperclip className="w-3 h-3" /> Attachments ({atts.length})
                    </p>
                    {atts.length === 0 && <p className="text-xs text-gray-400 italic">No attachments</p>}
                    {atts.map(att => (
                      <div key={att.id} className="border border-gray-200 rounded p-2 mb-1 bg-white">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-xs text-gray-800 truncate">{att.original_name} {att.file_size ? `(${fmtSize(att.file_size)})` : ''}</span>
                          <div className="flex items-center gap-1">
                            <a href={`/api/transports/${t.id}/attachments/${att.id}/download`} target="_blank" rel="noopener noreferrer" className="p-1 text-gray-400 hover:text-blue-600" title="Download"><Download className="w-3 h-3" /></a>
                            <button onClick={() => window.open(`/api/transports/${t.id}/attachments/${att.id}/download`, '_blank')} className="p-1 text-gray-400 hover:text-blue-600" title="Print"><Printer className="w-3 h-3" /></button>
                            <button
                              onClick={() => setEmailForms(prev => ({ ...prev, [att.id]: { ...(prev[att.id] || {}), open: !prev[att.id]?.open } }))}
                              className="p-1 text-gray-400 hover:text-blue-600" title="Email"
                            ><Mail className="w-3 h-3" /></button>
                          </div>
                        </div>
                        {emailForms[att.id]?.open && (
                          <div className="mt-2 space-y-1">
                            <input type="email" placeholder="To" className="w-full text-xs p-1 border border-gray-300 rounded"
                              value={emailForms[att.id]?.to || ''} onChange={e => setEmailForms(prev => ({ ...prev, [att.id]: { ...prev[att.id], to: e.target.value } }))} />
                            <input type="text" placeholder="Subject" className="w-full text-xs p-1 border border-gray-300 rounded"
                              value={emailForms[att.id]?.subject || ''} onChange={e => setEmailForms(prev => ({ ...prev, [att.id]: { ...prev[att.id], subject: e.target.value } }))} />
                            <textarea placeholder="Message" rows={2} className="w-full text-xs p-1 border border-gray-300 rounded"
                              value={emailForms[att.id]?.message || ''} onChange={e => setEmailForms(prev => ({ ...prev, [att.id]: { ...prev[att.id], message: e.target.value } }))} />
                            <div className="flex gap-1">
                              <button onClick={() => handleEmailAtt(t.id, att.id)} className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">Send</button>
                              <button onClick={() => setEmailForms(prev => ({ ...prev, [att.id]: { ...prev[att.id], open: false } }))} className="text-xs text-gray-500 px-2 py-1">Cancel</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── FH Profile Tab ───────────────────────────────────────────────────────────

const FHProfileTab = ({ currentUser, onProfileUpdated }) => {
  const [profileForm, setProfileForm] = useState({ email: currentUser?.email || '', phone: currentUser?.phone || '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);
  const [defaults, setDefaults] = useState({ default_destination: '', default_contact_name: '', default_contact_phone: '', default_destination_contact: '', default_destination_phone: '', notes: '' });
  const [defaultsSaving, setDefaultsSaving] = useState(false);
  const [defaultsMsg, setDefaultsMsg] = useState(null);

  useEffect(() => {
    apiRequest('GET', '/auth/defaults').then(data => {
      if (data.defaults) {
        setDefaults({
          default_destination: data.defaults.default_destination || '',
          default_contact_name: data.defaults.default_contact_name || '',
          default_contact_phone: data.defaults.default_contact_phone || '',
          default_destination_contact: data.defaults.default_destination_contact || '',
          default_destination_phone: data.defaults.default_destination_phone || '',
          notes: data.defaults.notes || '',
        });
      }
    }).catch(() => {});
  }, []);

  const saveProfile = async () => {
    setProfileSaving(true);
    try {
      const { user } = await apiRequest('PUT', '/auth/profile', profileForm);
      onProfileUpdated?.(user);
      setProfileMsg({ type: 'success', text: 'Profile saved!' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message });
    } finally {
      setProfileSaving(false);
      setTimeout(() => setProfileMsg(null), 3000);
    }
  };

  const saveDefaults = async () => {
    setDefaultsSaving(true);
    try {
      await apiRequest('PUT', '/auth/defaults', defaults);
      setDefaultsMsg({ type: 'success', text: 'Defaults saved!' });
    } catch (err) {
      setDefaultsMsg({ type: 'error', text: err.message });
    } finally {
      setDefaultsSaving(false);
      setTimeout(() => setDefaultsMsg(null), 3000);
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <h2 className="text-lg font-semibold">👤 My Profile</h2>

      {/* Profile Card */}
      <div className="bg-white rounded-lg shadow-sm border p-4 space-y-3">
        <h3 className="font-medium text-gray-800">Account Info</h3>
        <div className="text-sm text-gray-600">Username: <span className="font-medium text-gray-900">{currentUser?.username}</span></div>
        <div className="text-sm text-gray-600">Funeral Home: <span className="font-medium text-gray-900">{currentUser?.funeral_home_name || '—'}</span></div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            value={profileForm.email} onChange={e => setProfileForm(p => ({ ...p, email: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input type="tel" className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            value={profileForm.phone} onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))} />
        </div>
        {profileMsg && <p className={`text-sm ${profileMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{profileMsg.text}</p>}
        <button onClick={saveProfile} disabled={profileSaving}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
          {profileSaving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>

      {/* Defaults Card */}
      <div className="bg-white rounded-lg shadow-sm border p-4 space-y-3">
        <h3 className="font-medium text-gray-800">Request Defaults</h3>
        <p className="text-xs text-gray-500">These will pre-fill new transport requests automatically.</p>
        {[
          ['default_destination', 'Default Destination'],
          ['default_contact_name', 'Default Contact Name'],
          ['default_contact_phone', 'Default Contact Phone'],
          ['default_destination_contact', 'Destination Contact'],
          ['default_destination_phone', 'Destination Phone'],
        ].map(([key, label]) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <input type="text" className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              value={defaults[key]} onChange={e => setDefaults(p => ({ ...p, [key]: e.target.value }))} />
          </div>
        ))}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea rows={2} className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            value={defaults.notes} onChange={e => setDefaults(p => ({ ...p, notes: e.target.value }))} />
        </div>
        {defaultsMsg && <p className={`text-sm ${defaultsMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{defaultsMsg.text}</p>}
        <button onClick={saveDefaults} disabled={defaultsSaving}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
          {defaultsSaving ? 'Saving...' : 'Save Defaults'}
        </button>
      </div>
    </div>
  );
};

// ─── Profile Modal ────────────────────────────────────────────────────────────

const ProfileModal = ({ currentUser, onClose, onProfileUpdated }) => {
  const [profileForm, setProfileForm] = useState({
    email: currentUser?.email || '',
    phone: currentUser?.phone || '',
    funeral_home_name: currentUser?.funeral_home_name || '',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null); // { type: 'success'|'error', text }

  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);

  // Load fresh profile data on open
  useEffect(() => {
    apiRequest('GET', '/auth/me').then(({ user }) => {
      setProfileForm({
        email: user.email || '',
        phone: user.phone || '',
        funeral_home_name: user.funeral_home_name || '',
      });
    }).catch(() => {});
  }, []);

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const { user } = await apiRequest('PUT', '/auth/profile', profileForm);
      onProfileUpdated(user);
      setProfileMsg({ type: 'success', text: '✅ Profile saved' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!pwForm.current_password || !pwForm.new_password) {
      setPwMsg({ type: 'error', text: 'All password fields are required' });
      return;
    }
    if (pwForm.new_password.length < 6) {
      setPwMsg({ type: 'error', text: 'New password must be at least 6 characters' });
      return;
    }
    if (pwForm.new_password !== pwForm.confirm_password) {
      setPwMsg({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    setPwSaving(true);
    setPwMsg(null);
    try {
      await apiRequest('PUT', '/auth/change-password', {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      });
      setPwMsg({ type: 'success', text: '✅ Password changed successfully' });
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      setPwMsg({ type: 'error', text: err.message });
    } finally {
      setPwSaving(false);
    }
  };

  const ROLE_BADGE = {
    admin: 'bg-red-100 text-red-700',
    employee: 'bg-blue-100 text-blue-700',
    funeral_home: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10 rounded-t-xl">
          <h2 className="text-lg font-semibold text-gray-900">👤 My Profile</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* My Profile Section */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Account Info</h3>
            <div className="space-y-1 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Username:</span>
                <span className="text-sm text-gray-900 font-mono">{currentUser?.username}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Role:</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[currentUser?.role] || 'bg-gray-100 text-gray-700'}`}>
                  {currentUser?.role}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={e => setProfileForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="your@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="(555) 123-4567"
                />
              </div>
              {currentUser?.role === 'funeral_home' && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Funeral Home</label>
                  <input
                    type="text"
                    value={profileForm.funeral_home_name}
                    onChange={e => setProfileForm(p => ({ ...p, funeral_home_name: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="Funeral home name"
                  />
                </div>
              )}
              {profileMsg && (
                <div className={`text-sm px-3 py-2 rounded-lg ${profileMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {profileMsg.text}
                </div>
              )}
              <button
                onClick={handleSaveProfile}
                disabled={profileSaving}
                className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {profileSaving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </section>

          <div className="border-t" />

          {/* Change Password Section */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Change Password</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Current Password</label>
                <input
                  type="password"
                  value={pwForm.current_password}
                  onChange={e => setPwForm(p => ({ ...p, current_password: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Current password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">New Password</label>
                <input
                  type="password"
                  value={pwForm.new_password}
                  onChange={e => setPwForm(p => ({ ...p, new_password: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Min 6 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={pwForm.confirm_password}
                  onChange={e => setPwForm(p => ({ ...p, confirm_password: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Repeat new password"
                />
              </div>
              {pwMsg && (
                <div className={`text-sm px-3 py-2 rounded-lg ${pwMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {pwMsg.text}
                </div>
              )}
              <button
                onClick={handleChangePassword}
                disabled={pwSaving}
                className="w-full bg-gray-800 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
              >
                {pwSaving ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

// ─── Admin Users Panel ────────────────────────────────────────────────────────

const ROLE_BADGE_COLORS = {
  admin: 'bg-red-100 text-red-700',
  employee: 'bg-blue-100 text-blue-700',
  funeral_home: 'bg-gray-100 text-gray-700',
};

const AdminUsersPanel = () => {
  const [section, setSection] = useState('users'); // 'users' | 'codes'
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [activeTransportUserIds, setActiveTransportUserIds] = useState(new Set());

  // Edit state
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Reset password state
  const [resetUserId, setResetUserId] = useState(null);
  const [resetPw, setResetPw] = useState('');
  const [resetSaving, setResetSaving] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  // Delete state
  const [deleteUserId, setDeleteUserId] = useState(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  // Create user state
  const EMPTY_CREATE = { username: '', email: '', phone: '', password: '', role: 'employee', funeral_home_name: '' };
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  // Invite codes state
  const [codes, setCodes] = useState([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [codeRole, setCodeRole] = useState('employee');
  const [generating, setGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [revoking, setRevoking] = useState(null);

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const { users: data } = await apiRequest('GET', '/admin/users');
      setUsers(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setUsersLoading(false);
    }
  };

  const loadActiveTransports = async () => {
    try {
      const { transports } = await apiRequest('GET', '/transports');
      const ids = new Set(
        (transports || [])
          .filter(t => !['Completed', 'Cancelled'].includes(t.status) && t.createdByUserId)
          .map(t => t.createdByUserId)
      );
      setActiveTransportUserIds(ids);
    } catch(_) {}
  };

  const loadCodes = async () => {
    setCodesLoading(true);
    try {
      const { codes: data } = await apiRequest('GET', '/admin/invite-codes');
      setCodes(data || []);
    } catch (err) {
      setCodeError(err.message);
    } finally {
      setCodesLoading(false);
    }
  };

  useEffect(() => { loadUsers(); loadActiveTransports(); }, []);
  useEffect(() => { if (section === 'codes') loadCodes(); }, [section]);

  // ── User CRUD handlers ───────────────────────────────────────────────────

  const openEdit = (u) => {
    setEditingUser(u);
    setEditForm({ email: u.email || '', phone: u.phone || '', role: u.role, funeral_home_name: u.funeral_home_name || '', display_name: u.display_name || '' });
    setEditError('');
    setResetUserId(null);
    setDeleteUserId(null);
  };

  const handleSaveEdit = async () => {
    setEditSaving(true);
    setEditError('');
    try {
      const { user } = await apiRequest('PUT', `/admin/users/${editingUser.id}`, editForm);
      setUsers(prev => prev.map(u => u.id === user.id ? user : u));
      setEditingUser(null);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPw || resetPw.length < 6) {
      setResetError('Password must be at least 6 characters');
      return;
    }
    setResetSaving(true);
    setResetError('');
    setResetSuccess('');
    try {
      await apiRequest('PUT', `/admin/users/${resetUserId}/reset-password`, { new_password: resetPw });
      setResetSuccess('✅ Password reset successfully');
      setResetPw('');
      setTimeout(() => { setResetUserId(null); setResetSuccess(''); }, 2000);
    } catch (err) {
      setResetError(err.message);
    } finally {
      setResetSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleteSaving(true);
    try {
      await apiRequest('DELETE', `/admin/users/${deleteUserId}`);
      setUsers(prev => prev.filter(u => u.id !== deleteUserId));
      setDeleteUserId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleteSaving(false);
    }
  };

  const handleCreate = async () => {
    setCreateError('');
    setCreateSuccess('');
    if (!createForm.username || !createForm.password) {
      setCreateError('Username and password are required');
      return;
    }
    if (createForm.role === 'funeral_home' && !createForm.funeral_home_name) {
      setCreateError('Funeral home name is required');
      return;
    }
    setCreateSaving(true);
    try {
      const { user } = await apiRequest('POST', '/admin/users', createForm);
      setUsers(prev => [...prev, user]);
      setCreateForm(EMPTY_CREATE);
      setCreateSuccess(`✅ User "${user.username}" created`);
      setShowCreate(false);
      setTimeout(() => setCreateSuccess(''), 4000);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreateSaving(false);
    }
  };

  // ── Invite code handlers ─────────────────────────────────────────────────

  const handleGenerateCode = async () => {
    setGenerating(true);
    setCodeError('');
    setGeneratedCode(null);
    try {
      const { code } = await apiRequest('POST', '/admin/invite-codes', { role: codeRole });
      setGeneratedCode(code);
      setCodeCopied(false);
      loadCodes();
    } catch (err) {
      setCodeError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleRevokeCode = async (id) => {
    setRevoking(id);
    try {
      await apiRequest('DELETE', `/admin/invite-codes/${id}`);
      setCodes(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      setCodeError(err.message);
    } finally {
      setRevoking(null);
    }
  };

  // ── Filtered users ───────────────────────────────────────────────────────

  const q = search.toLowerCase();
  const isOnline = (u) => u.last_seen_at && (Date.now() - new Date(u.last_seen_at + 'Z').getTime()) < 30 * 60 * 1000;
  const filtered = [...users]
    .filter(u =>
      !q ||
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q) ||
      u.funeral_home_name?.toLowerCase().includes(q)
    )
    .sort((a, b) => {
      const aActive = activeTransportUserIds.has(a.id);
      const bActive = activeTransportUserIds.has(b.id);
      const aOn = isOnline(a);
      const bOn = isOnline(b);
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      if (aOn && !bOn) return -1;
      if (!aOn && bOn) return 1;
      return 0;
    });

  const codeStatus = (c) => {
    if (c.used_by) return { label: 'Used', color: 'bg-blue-100 text-blue-700' };
    if (new Date(c.expires_at) < new Date()) return { label: 'Expired', color: 'bg-red-100 text-red-700' };
    return { label: 'Active', color: 'bg-green-100 text-green-700' };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">👥 User Management</h2>
        <button
          onClick={() => { setShowCreate(s => !s); setCreateError(''); setCreateSuccess(''); }}
          className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium"
        >
          <Plus className="w-4 h-4" /> New User
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          <button onClick={() => setError('')} className="ml-auto">×</button>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setSection('users')}
          className={`py-2 px-4 text-sm font-medium border-b-2 -mb-px ${section === 'users' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <Users className="w-4 h-4 inline mr-1" />All Users ({users.length})
        </button>
        <button
          onClick={() => setSection('codes')}
          className={`py-2 px-4 text-sm font-medium border-b-2 -mb-px ${section === 'codes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          🔑 Access Codes
        </button>
      </div>

      {/* ── Users Section ────────────────────────────────────────────────── */}
      {section === 'users' && (
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search username, email, role, funeral home..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          {/* Create form */}
          {showCreate && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-gray-800">➕ Create New User</h3>
              {createError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">{createError}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Username *</label>
                  <input type="text" value={createForm.username} onChange={e => setCreateForm(p => ({ ...p, username: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="username" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Password *</label>
                  <input type="password" value={createForm.password} onChange={e => setCreateForm(p => ({ ...p, password: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="Min 6 chars" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input type="email" value={createForm.email} onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="email@example.com" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                  <input type="tel" value={createForm.phone} onChange={e => setCreateForm(p => ({ ...p, phone: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="(555) 123-4567" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Role *</label>
                  <select value={createForm.role} onChange={e => setCreateForm(p => ({ ...p, role: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded text-sm">
                    <option value="admin">Admin</option>
                    <option value="employee">Employee</option>
                    <option value="funeral_home">Funeral Home</option>
                  </select>
                </div>
                {createForm.role === 'funeral_home' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Funeral Home *</label>
                    <input type="text" value={createForm.funeral_home_name} onChange={e => setCreateForm(p => ({ ...p, funeral_home_name: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="Funeral home name" />
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowCreate(false); setCreateError(''); }} className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                <button onClick={handleCreate} disabled={createSaving} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {createSaving ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </div>
          )}

          {createSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded text-sm">{createSuccess}</div>
          )}

          {/* User list */}
          {usersLoading ? (
            <div className="text-center py-8 text-gray-400"><Loader className="w-6 h-6 animate-spin mx-auto mb-2" />Loading users...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No users found</div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left p-3 font-medium text-gray-600">User</th>
                    <th className="text-left p-3 font-medium text-gray-600 hidden sm:table-cell">Name</th>
                    <th className="text-left p-3 font-medium text-gray-600 hidden sm:table-cell">Email / Phone</th>
                    <th className="text-left p-3 font-medium text-gray-600 hidden md:table-cell">Funeral Home</th>
                    <th className="text-left p-3 font-medium text-gray-600 hidden sm:table-cell">Joined</th>
                    <th className="p-3 w-28 text-right font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(u => (
                    <React.Fragment key={u.id}>
                      <tr className="hover:bg-gray-50">
                        <td className="p-3">
                          <div className="font-medium text-gray-900 flex items-center gap-1">
                            {u.username}
                            {isOnline(u) && (
                              <span className="inline-block w-2 h-2 rounded-full bg-green-500 flex-shrink-0" title="Online recently" />
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-wrap mt-0.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ROLE_BADGE_COLORS[u.role] || 'bg-gray-100 text-gray-700'}`}>{u.role}</span>
                            {activeTransportUserIds.has(u.id) && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">🚗 Active Call</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-gray-700 hidden sm:table-cell">{u.display_name || <span className="italic text-gray-300">—</span>}</td>
                        <td className="p-3 text-gray-500 hidden sm:table-cell">
                          <div>{u.email || <span className="italic text-gray-300">—</span>}</div>
                          <div className="text-xs">{u.phone || ''}</div>
                        </td>
                        <td className="p-3 text-gray-500 hidden md:table-cell">{u.funeral_home_name || <span className="italic text-gray-300">—</span>}</td>
                        <td className="p-3 text-gray-400 text-xs hidden sm:table-cell">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => openEdit(editingUser?.id === u.id ? null : u)}
                              className={`p-1.5 rounded hover:bg-blue-50 ${editingUser?.id === u.id ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'}`} title="Edit">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => { setResetUserId(resetUserId === u.id ? null : u.id); setResetPw(''); setResetError(''); setResetSuccess(''); setEditingUser(null); setDeleteUserId(null); }}
                              className={`p-1.5 rounded hover:bg-yellow-50 ${resetUserId === u.id ? 'text-yellow-600' : 'text-gray-400 hover:text-yellow-600'}`} title="Reset Password">
                              🔑
                            </button>
                            <button onClick={() => { setDeleteUserId(deleteUserId === u.id ? null : u.id); setEditingUser(null); setResetUserId(null); }}
                              className={`p-1.5 rounded hover:bg-red-50 ${deleteUserId === u.id ? 'text-red-600' : 'text-gray-400 hover:text-red-600'}`} title="Delete">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Inline edit row */}
                      {editingUser?.id === u.id && (
                        <tr>
                          <td colSpan={6} className="px-3 pb-3 bg-blue-50">
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                                <input type="text" value={editForm.display_name || ''} onChange={e => setEditForm(p => ({ ...p, display_name: e.target.value }))}
                                  className="w-full p-1.5 border border-gray-300 rounded text-sm" placeholder="First Last" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                                <input type="email" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                                  className="w-full p-1.5 border border-gray-300 rounded text-sm" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                                <input type="tel" value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))}
                                  className="w-full p-1.5 border border-gray-300 rounded text-sm" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                                <select value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))}
                                  className="w-full p-1.5 border border-gray-300 rounded text-sm">
                                  <option value="admin">Admin</option>
                                  <option value="employee">Employee</option>
                                  <option value="funeral_home">Funeral Home</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Funeral Home</label>
                                <input type="text" value={editForm.funeral_home_name} onChange={e => setEditForm(p => ({ ...p, funeral_home_name: e.target.value }))}
                                  className="w-full p-1.5 border border-gray-300 rounded text-sm" />
                              </div>
                            </div>
                            {editError && <div className="text-xs text-red-600 mt-1">{editError}</div>}
                            <div className="flex gap-2 mt-2">
                              <button onClick={() => setEditingUser(null)} className="flex-1 py-1.5 border border-gray-300 text-gray-600 rounded text-xs hover:bg-gray-50">Cancel</button>
                              <button onClick={handleSaveEdit} disabled={editSaving} className="flex-1 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
                                {editSaving ? 'Saving...' : 'Save'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Inline reset password row */}
                      {resetUserId === u.id && (
                        <tr>
                          <td colSpan={6} className="px-3 pb-3 bg-yellow-50">
                            <div className="mt-2 space-y-2">
                              <p className="text-xs text-yellow-800 font-medium">Reset password for <strong>{u.username}</strong> (no old password required)</p>
                              <div className="flex gap-2">
                                <input type="password" value={resetPw} onChange={e => setResetPw(e.target.value)}
                                  className="flex-1 p-1.5 border border-gray-300 rounded text-sm" placeholder="New password (min 6)" />
                                <button onClick={handleResetPassword} disabled={resetSaving}
                                  className="px-3 py-1.5 bg-yellow-600 text-white rounded text-xs font-medium hover:bg-yellow-700 disabled:opacity-50">
                                  {resetSaving ? '...' : 'Reset'}
                                </button>
                                <button onClick={() => setResetUserId(null)} className="px-2 py-1.5 border border-gray-300 text-gray-600 rounded text-xs hover:bg-gray-50">✕</button>
                              </div>
                              {resetError && <div className="text-xs text-red-600">{resetError}</div>}
                              {resetSuccess && <div className="text-xs text-green-700">{resetSuccess}</div>}
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Inline delete confirm row */}
                      {deleteUserId === u.id && (
                        <tr>
                          <td colSpan={6} className="px-3 pb-3 bg-red-50">
                            <div className="mt-2">
                              <p className="text-xs text-red-800 font-medium mb-2">Delete <strong>{u.username}</strong>? This cannot be undone.</p>
                              <div className="flex gap-2">
                                <button onClick={() => setDeleteUserId(null)} className="flex-1 py-1.5 border border-gray-300 text-gray-600 rounded text-xs hover:bg-gray-50">Cancel</button>
                                <button onClick={handleDelete} disabled={deleteSaving} className="flex-1 py-1.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 disabled:opacity-50">
                                  {deleteSaving ? 'Deleting...' : 'Delete'}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Access Codes Section ─────────────────────────────────────────── */}
      {section === 'codes' && (
        <div className="space-y-4">
          {codeError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{codeError}
              <button onClick={() => setCodeError('')} className="ml-auto">×</button>
            </div>
          )}

          {/* Generate code card */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <h3 className="font-semibold text-gray-800">🔑 Generate Access Code</h3>
            <p className="text-xs text-gray-500">Generate a one-time code for a new user to self-register. Codes expire in 7 days.</p>

            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                <select
                  value={codeRole}
                  onChange={e => setCodeRole(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button
                onClick={handleGenerateCode}
                disabled={generating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
              >
                {generating ? <Loader className="w-4 h-4 animate-spin inline mr-1" /> : null}
                {generating ? 'Generating...' : 'Generate Code'}
              </button>
            </div>

            {/* Generated code display */}
            {generatedCode && (
              <div className="bg-green-50 border border-green-300 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">New Access Code</span>
                  <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Expires in 7 days</span>
                </div>
                <div className="flex items-center gap-2 bg-white border border-green-200 rounded-lg px-3 py-2">
                  <code className="flex-1 text-lg font-mono font-bold tracking-widest text-gray-900">{generatedCode.code}</code>
                  <button
                    onClick={() => handleCopyCode(generatedCode.code)}
                    className="text-sm px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center gap-1"
                  >
                    {codeCopied ? '✓ Copied!' : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                  </button>
                </div>
                {/* SMS intent button */}
                <a
                  href={`sms:?body=Your FCR access code: ${generatedCode.code}. Register at https://firstcallremovals.com — expires in 7 days.`}
                  className="flex items-center justify-center gap-2 w-full py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900"
                >
                  📱 Send via SMS
                </a>
                <p className="text-xs text-green-600 text-center">
                  Share this code with your new {generatedCode.role}. It can only be used once.
                </p>
              </div>
            )}
          </div>

          {/* Code list */}
          {codesLoading ? (
            <div className="text-center py-6 text-gray-400"><Loader className="w-5 h-5 animate-spin mx-auto mb-1" />Loading codes...</div>
          ) : codes.length === 0 ? (
            <div className="text-center py-8 text-gray-400 bg-white rounded-xl border border-gray-200">
              <div className="text-3xl mb-2">🔑</div>
              <p className="text-sm">No access codes yet. Generate one above.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                All Access Codes
              </div>
              <div className="divide-y divide-gray-100">
                {codes.map(c => {
                  const s = codeStatus(c);
                  const isActive = s.label === 'Active';
                  return (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="font-mono font-bold text-gray-900 tracking-wider">{c.code}</code>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ROLE_BADGE_COLORS[c.role] || 'bg-gray-100 text-gray-700'}`}>{c.role}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          Created {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
                          {' · '}Expires {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '—'}
                          {c.used_by && <span className="text-blue-500 ml-1">· Used by {c.used_by}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isActive && (
                          <>
                            <button
                              onClick={() => handleCopyCode(c.code)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Copy code"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <a
                              href={`sms:?body=Your FCR access code: ${c.code}. Register at https://firstcallremovals.com — expires in 7 days.`}
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded" title="Send via SMS"
                            >
                              📱
                            </a>
                            <button
                              onClick={() => handleRevokeCode(c.id)}
                              disabled={revoking === c.id}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Revoke"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Odometer Modal ─────────────────────────────────────────────── */}
      {odometerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">
              {odometerModal.type === 'start' ? '🚐 Starting Transport' : '✅ Complete Transport'}
            </h2>
            <p className="text-sm text-gray-600">
              {odometerModal.type === 'start'
                ? 'Please enter your current odometer reading before departing.'
                : 'Please enter your odometer reading at delivery.'}
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {odometerModal.type === 'start' ? 'Current Odometer' : 'End Odometer'} (miles)
              </label>
              <input
                type="number"
                value={odometerInput}
                onChange={e => setOdometerInput(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 45230"
                autoFocus
              />
              {odometerModal.type === 'end' && odometerModal.odometerStart && (
                <p className="text-xs text-gray-500 mt-1">Started at: {odometerModal.odometerStart.toLocaleString()} mi</p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setOdometerModal(null); setOdometerInput(''); }}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const reading = odometerInput ? parseInt(odometerInput) : null;
                  const { transportId, newStatus, eta, type } = odometerModal;
                  setOdometerModal(null);
                  setOdometerInput('');
                  await doAdvanceTransportStatus(transportId, newStatus, eta, reading, type);
                }}
                disabled={odometerLoading}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {odometerModal.type === 'start' ? 'Start Transport →' : 'Complete Transport ✓'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ───────────────────────────────────────────────────────── */}
      {toastMessage && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium animate-pulse">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default FuneralTransportApp;
