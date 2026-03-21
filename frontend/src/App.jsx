import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  MapPin, Plus, Truck, Clock, Phone, User, Calendar, Weight,
  CheckCircle, LogIn, Users, Settings, Navigation, Bell, AlertCircle,
  ChevronRight, Activity, Package, Flag, Loader, Wand2, X, ChevronDown, ChevronUp,
  Building2, Upload, Edit2, Trash2, Wrench, Copy, FileText, History, Search
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
};

const STATUS_DOT = {
  'Pending':   'bg-yellow-400',
  'Accepted':  'bg-blue-500',
  'En Route':  'bg-indigo-500',
  'Arrived':   'bg-orange-500',
  'Loaded':    'bg-purple-500',
  'Completed': 'bg-green-500',
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
const DispatchCard = ({ transport, userRole, onAdvance, loading, etaValues, setEtaValue, onAssign, drivers, vehicles, onEdit }) => {
  const [showAssign, setShowAssign] = useState(false);
  const [selDriver, setSelDriver] = useState(transport.assignedDriverId || '');
  const [selVehicle, setSelVehicle] = useState(transport.assignedVehicleId || '');

  const availableDrivers = (drivers || []).filter(d => d.status === 'Available' || d.id === transport.assignedDriverId);
  const availableVehicles = (vehicles || []).filter(v => v.status === 'Available' || v.id === transport.assignedVehicleId);

  return (
    <div className={`bg-white rounded-lg shadow-sm border-l-4 p-3 ${
      transport.status === 'Pending' ? 'border-yellow-400' :
      transport.status === 'Accepted' ? 'border-blue-400' :
      transport.status === 'En Route' ? 'border-indigo-400' :
      transport.status === 'Arrived' ? 'border-orange-400' :
      transport.status === 'Loaded' ? 'border-purple-400' :
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

      {(userRole === 'employee' || userRole === 'admin') && transport.status !== 'Completed' && (
        <AdvanceStatusButton
          transport={transport}
          onAdvance={onAdvance}
          loading={loading}
          etaValue={etaValues[transport.id]}
          onEtaChange={(v) => setEtaValue(transport.id, v)}
        />
      )}
    </div>
  );
};

// ─── Dispatch Board ───────────────────────────────────────────────────────────

const DispatchBoard = ({ transports, userRole, onAdvance, loading, etaValues, setEtaValue, onAssign, drivers, vehicles, onEdit }) => {
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

const FleetTab = ({ drivers, vehicles, onRefresh, adminUsersData, adminUsersLoading, adminUsersSearch, setAdminUsersSearch, onLoadUsers }) => {
  const [fleetSection, setFleetSection] = useState('drivers'); // 'drivers' | 'vehicles' | 'users'

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
          onClick={() => { setFleetSection('users'); setShowDriverForm(false); setShowVehicleForm(false); }}
          className={`flex-shrink-0 py-2 px-4 text-sm font-medium border-b-2 -mb-px ${fleetSection === 'users' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          👥 Users
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

      {/* ── Users Section ────────────────────────────────────────────────── */}
      {fleetSection === 'users' && (
        <AdminUsersView
          adminUsersData={adminUsersData}
          adminUsersLoading={adminUsersLoading}
          adminUsersSearch={adminUsersSearch}
          setAdminUsersSearch={setAdminUsersSearch}
          onLoadUsers={onLoadUsers}
        />
      )}

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
};

const EMPTY_FH_FORM = {
  name: '', address: '', city: '', state: '', zip: '',
  phone: '', email: '', default_destination: '', intake_format: '', notes: ''
};

const locationTypes = [
  'Residential', 'Nursing Home', 'ALF', 'Hospital',
  'Funeral Home/Care Center', 'State Facility', 'Hospice', 'MEO/Lab'
];

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

  // Auto-dismiss alerts after 30 seconds
  useEffect(() => {
    if (!alerts.length) return;
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
    setFormData(prev => ({ ...prev, [field]: value }));
    if (aiFilledFields[field]) {
      setAiFilledFields(prev => { const n = { ...prev }; delete n[field]; return n; });
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
      // New flow: email verification required — no token returned until verified
      if (result.success && result.message) {
        setRegisterError('');
        setShowRegister(false);
        setShowVerifyPrompt(true);
        return;
      }
      // Legacy / employee flow: token returned immediately
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
      });
      setTransports(prev => [transport, ...prev]);
      setFormData(EMPTY_FORM);
      setAiFilledFields({});
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
    setLoading(true);
    try {
      const body = { status: newStatus };
      if (eta) body.eta = eta;
      const { transport } = await apiRequest('PUT', `/transports/${transportId}`, body);
      setTransports(prev => prev.map(t => t.id === transportId ? transport : t));
      // Clear eta input for this transport
      setEtaValues(prev => { const n = { ...prev }; delete n[transportId]; return n; });
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
  const activeCount = transports.filter(t => !['Pending', 'Completed'].includes(t.status)).length;

  // ── Login screen ─────────────────────────────────────────────────────────

  if (!isLoggedIn) {
    // Email verification success prompt
    if (showVerifyPrompt) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-md text-center">
            <img src="/logos/wings-only.jpg" alt="STAT First Call Removals" className="h-20 mx-auto mb-4 object-contain" />
            <div className="text-5xl mb-4">✉️</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Check Your Email</h2>
            <p className="text-gray-600 mb-6">
              We sent a verification link to your email address. Click the link to activate your account, then come back to log in.
            </p>
            <p className="text-xs text-gray-400 mb-6">The link expires in 24 hours. Check your spam folder if you don't see it.</p>
            <button
              onClick={() => setShowVerifyPrompt(false)}
              className="w-full py-2 px-4 bg-gray-800 text-white rounded-lg hover:bg-gray-700 font-medium"
            >
              Back to Login
            </button>
          </div>
        </div>
      );
    }

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
          </div>
          {!showRegister ? (
            <div className="space-y-4">
              {loginError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
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
            <img
              src="/logos/wings-only.jpg"
              alt="STAT"
              className="h-10 w-auto object-contain rounded"
            />
            <div>
            <h1 className="text-xl font-bold">STAT First Call Removals</h1>
            <p className="text-gray-300 text-sm">
              {userRole && userRole.replace('_', ' ').toUpperCase()} Portal
              {currentUser && <span className="ml-2 opacity-70">— {currentUser.username}</span>}
              {lastRefresh && (
                <span className="ml-2 opacity-50 text-xs">
                  Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {alerts.length > 0 && (
              <div className="relative">
                <Bell className="w-5 h-5 text-yellow-300" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                  {alerts.length}
                </span>
              </div>
            )}
            <button onClick={handleLogout} className="text-gray-300 hover:text-white text-sm">
              Logout
            </button>
          </div>
        </div>
      </div>

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
              <TabBtn active={activeTab === 'history'} onClick={() => setActiveTab('history')}>
                📋 History
              </TabBtn>
              <TabBtn active={activeTab === 'documents'} onClick={() => setActiveTab('documents')}>
                📄 Documents
              </TabBtn>
            </>
          )}

          {(userRole === 'employee' || userRole === 'admin') && (
            <>
              <TabBtn active={activeTab === 'dispatch'} onClick={() => setActiveTab('dispatch')}>
                <Activity className="w-4 h-4 inline mr-1" />Dispatch Board
                {pendingCount > 0 && <span className="ml-1 bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pendingCount}</span>}
              </TabBtn>
              <TabBtn active={activeTab === 'schedule'} onClick={() => setActiveTab('schedule')}>
                📅 Schedule
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
                </>
              )}
            </>
          )}
        </div>
      </div>

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

        {/* ── New Request Tab (Funeral Homes) ─────────────────────────── */}
        {activeTab === 'request' && userRole === 'funeral_home' && (
          <div>
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
                  <TransportCard key={transport.id} transport={transport} onSaveNotes={saveNotes} onCopyCase={handleCopyCase} copiedId={copiedId} />
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

        {/* ── History Tab (Funeral Home) ───────────────────────────────── */}
        {activeTab === 'history' && userRole === 'funeral_home' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">📋 Completed Transports</h2>
            {(() => {
              const completed = myTransports.filter(t => t.status === 'Completed').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
              if (!completed.length) return (
                <div className="text-center py-12">
                  <History className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">No completed transports yet</p>
                </div>
              );
              return (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left p-3 font-medium text-gray-600">Case #</th>
                        <th className="text-left p-3 font-medium text-gray-600">Decedent</th>
                        <th className="text-left p-3 font-medium text-gray-600 hidden sm:table-cell">Date</th>
                        <th className="text-right p-3 font-medium text-gray-600">Cost</th>
                        <th className="text-center p-3 font-medium text-gray-600">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {completed.map(t => (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="p-3">
                            <div className="flex items-center gap-1">
                              <span className="font-mono text-xs text-gray-600">{t.caseNumber || t.id}</span>
                              {t.caseNumber && (
                                <button onClick={() => handleCopyCase(t.caseNumber, t.id)} className="text-gray-300 hover:text-blue-500" title="Copy">
                                  {copiedId === t.id ? <span className="text-green-600 text-xs">✓</span> : <Copy className="w-3 h-3" />}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="p-3 font-medium text-gray-900">{t.decedentName || '—'}</td>
                          <td className="p-3 text-gray-500 hidden sm:table-cell">{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}</td>
                          <td className="p-3 text-right font-semibold text-gray-800">${t.totalCost?.toFixed(2) || '—'}</td>
                          <td className="p-3 text-center"><StatusBadge status={t.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── Schedule Tab (Admin/Employee) ────────────────────────────── */}
        {activeTab === 'schedule' && (userRole === 'admin' || userRole === 'employee') && (
          <div>
            <h2 className="text-lg font-semibold mb-4">📅 Scheduled Pickups</h2>
            {(() => {
              const scheduled = transports
                .filter(t => t.scheduledPickupAt && t.status === 'Pending')
                .sort((a, b) => new Date(a.scheduledPickupAt) - new Date(b.scheduledPickupAt));
              if (!scheduled.length) return (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">No upcoming scheduled transports</p>
                  <p className="text-xs text-gray-400 mt-1">Scheduled transports with Pending status appear here</p>
                </div>
              );
              return (
                <div className="space-y-2">
                  {scheduled.map(t => (
                    <div key={t.id} className="bg-white rounded-lg border border-indigo-100 shadow-sm p-4 flex items-center gap-4">
                      <div className="flex-shrink-0 text-center bg-indigo-50 rounded-lg p-2 min-w-[60px]">
                        <div className="text-xs text-indigo-500 font-medium">
                          {new Date(t.scheduledPickupAt).toLocaleDateString([], { month: 'short' }).toUpperCase()}
                        </div>
                        <div className="text-xl font-bold text-indigo-700">
                          {new Date(t.scheduledPickupAt).getDate()}
                        </div>
                        <div className="text-xs text-indigo-500">
                          {new Date(t.scheduledPickupAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900 truncate">{t.decedentName || '—'}</p>
                          <StatusBadge status={t.status} />
                        </div>
                        <p className="text-sm text-gray-500 truncate">{t.funeralHomeName}</p>
                        <p className="text-xs text-gray-400 truncate">{t.pickupLocation} → {t.destination}</p>
                      </div>
                      <div className="flex-shrink-0">
                        <button
                          onClick={() => setActiveTab('dispatch')}
                          className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 font-medium"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── Documents Tab ────────────────────────────────────────────── */}
        {activeTab === 'documents' && (
          <DocumentsPanel transports={transports} />
        )}

        {/* ── Fleet Tab (Admin only) ───────────────────────────────────── */}
        {activeTab === 'fleet' && userRole === 'admin' && (
          <FleetTab
            drivers={drivers}
            vehicles={vehicles}
            onRefresh={fetchData}
            adminUsersData={adminUsersData}
            adminUsersLoading={adminUsersLoading}
            adminUsersSearch={adminUsersSearch}
            setAdminUsersSearch={setAdminUsersSearch}
            onLoadUsers={fetchAdminUsers}
          />
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

// ─── Documents Panel ─────────────────────────────────────────────────────────

const DEFAULT_TEMPLATES = [
  {
    id: 'tpl-1',
    name: 'First Call Authorization',
    fields: ['decedent_name', 'date_of_death', 'pickup_location', 'funeral_home_name', 'funeral_home_phone', 'authorized_by', 'signature', 'date_signed'],
  },
  {
    id: 'tpl-2',
    name: 'Transport Release Form',
    fields: ['decedent_name', 'pickup_location', 'destination', 'driver_name', 'vehicle_id', 'notes', 'signature', 'date_signed'],
  },
  {
    id: 'tpl-3',
    name: 'Chain of Custody',
    fields: ['decedent_name', 'case_number', 'pickup_contact', 'pickup_phone', 'destination_contact', 'destination_phone', 'signature', 'date_signed'],
  },
];

function getTemplates() {
  try {
    const stored = localStorage.getItem('fcr_doc_templates');
    if (stored) return JSON.parse(stored);
  } catch (_) {}
  localStorage.setItem('fcr_doc_templates', JSON.stringify(DEFAULT_TEMPLATES));
  return DEFAULT_TEMPLATES;
}

function saveTemplates(tpls) {
  localStorage.setItem('fcr_doc_templates', JSON.stringify(tpls));
}

const TRANSPORT_FIELD_MAP = {
  decedent_name: 'decedentName',
  date_of_death: 'dateOfDeath',
  pickup_location: 'pickupLocation',
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
};

const DocumentsPanel = ({ transports }) => {
  const [section, setSection] = useState('templates'); // 'templates' | 'fill'
  const [templates, setTemplates] = useState(getTemplates);
  const [selectedTpl, setSelectedTpl] = useState('');
  const [selectedTransport, setSelectedTransport] = useState('');
  const [fieldValues, setFieldValues] = useState({});
  const [signatureData, setSignatureData] = useState(null);
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);

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

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) { canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height); }
    setSignatureData(null);
  };

  // Auto-fill from transport
  useEffect(() => {
    if (!selectedTransport) { setFieldValues({}); return; }
    const t = transports.find(t => t.id === selectedTransport);
    if (!t) return;
    const tpl = templates.find(tp => tp.id === selectedTpl);
    if (!tpl) return;
    const vals = {};
    for (const field of tpl.fields) {
      if (field === 'signature' || field === 'date_signed') continue;
      const key = TRANSPORT_FIELD_MAP[field];
      vals[field] = key ? (t[key] || '') : '';
    }
    vals['date_signed'] = new Date().toLocaleDateString();
    setFieldValues(vals);
  }, [selectedTransport, selectedTpl, transports, templates]);

  const handlePrint = () => {
    const tpl = templates.find(tp => tp.id === selectedTpl);
    if (!tpl) return;
    const printDiv = document.createElement('div');
    printDiv.id = 'fcr-print-doc';
    printDiv.innerHTML = `
      <style>
        @media print { body > *:not(#fcr-print-doc) { display: none !important; } #fcr-print-doc { display: block !important; } }
        #fcr-print-doc { font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 40px; }
        #fcr-print-doc h1 { font-size: 22px; border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 24px; }
        #fcr-print-doc .field-row { margin-bottom: 16px; }
        #fcr-print-doc .field-label { font-size: 11px; font-weight: bold; text-transform: uppercase; color: #555; margin-bottom: 4px; }
        #fcr-print-doc .field-value { font-size: 14px; border-bottom: 1px solid #ccc; padding: 4px 0; min-height: 24px; }
        #fcr-print-doc .sig-img { border: 1px solid #999; border-radius: 4px; }
      </style>
      <h1>${tpl.name}</h1>
      ${tpl.fields.map(f => {
        if (f === 'signature') return `<div class="field-row"><div class="field-label">Signature</div>${signatureData ? `<img src="${signatureData}" class="sig-img" style="height:80px;" />` : '<div class="field-value"></div>'}</div>`;
        const label = f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        return `<div class="field-row"><div class="field-label">${label}</div><div class="field-value">${fieldValues[f] || ''}</div></div>`;
      }).join('')}
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
            {templates.map(tpl => (
              <div key={tpl.id} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{tpl.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{tpl.fields.length} fields: {tpl.fields.slice(0, 4).join(', ')}{tpl.fields.length > 4 ? '...' : ''}</p>
                </div>
                <button
                  onClick={() => { setSelectedTpl(tpl.id); setSection('fill'); setFieldValues({}); setSignatureData(null); }}
                  className="text-sm bg-gray-100 text-gray-700 hover:bg-blue-50 hover:text-blue-600 px-3 py-1.5 rounded-lg font-medium"
                >
                  Fill →
                </button>
              </div>
            ))}
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
              <label className="block text-sm font-medium text-gray-600 mb-1">Auto-fill from Transport</label>
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
              <h3 className="font-semibold text-gray-800">{currentTpl.name}</h3>
              {currentTpl.fields.map(field => {
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
                      <button onClick={clearSignature} className="text-xs text-gray-500 hover:text-red-600 px-2 py-1 border border-gray-200 rounded">
                        Clear
                      </button>
                      {signatureData && <span className="text-xs text-green-600 py-1">✓ Signature saved</span>}
                    </div>
                  </div>
                );
                const label = field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                return (
                  <div key={field}>
                    <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>
                    <input
                      type="text"
                      value={fieldValues[field] || ''}
                      onChange={e => setFieldValues(prev => ({ ...prev, [field]: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded text-sm"
                      placeholder={label}
                    />
                  </div>
                );
              })}
              <button
                onClick={handlePrint}
                className="w-full bg-gray-900 text-white py-2.5 rounded-lg font-medium hover:bg-gray-800 flex items-center justify-center gap-2 mt-2"
              >
                🖨️ Download / Print PDF
              </button>
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
const TransportCard = ({ transport, onSaveNotes, onCopyCase, copiedId }) => {
  const [notesInput, setNotesInput] = useState(transport.notes || '');
  const [editingNotes, setEditingNotes] = useState(false);

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
    </div>
  );
};

export default FuneralTransportApp;
