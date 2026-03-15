import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Truck, Clock, Phone, User, Calendar, Weight, DollarSign, CheckCircle, LogIn, Users, Settings, Navigation } from 'lucide-react';

const FuneralTransportApp = () => {
  const [activeTab, setActiveTab] = useState('request');
  const [userRole, setUserRole] = useState('funeral_home'); // 'funeral_home', 'employee', 'admin'
  const [isLoggedIn, setIsLoggedIn] = useState(true); // Set to false for login screen
  const [requests, setRequests] = useState([]);
  const [activeTransports, setActiveTransports] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loginData, setLoginData] = useState({ username: '', password: '', role: 'employee' });
  const [formData, setFormData] = useState({
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
    estimatedMiles: 0
  });

  const locationTypes = [
    'Residential',
    'Nursing Home', 
    'ALF',
    'Hospital',
    'Funeral Home/Care Center',
    'State Facility',
    'Hospice',
    'MEO/Lab'
  ];

  // Sample data for demonstration
  useEffect(() => {
    setActiveTransports([
      {
        id: 'TR001',
        date: '2025-06-27',
        pickupLocation: 'Dallas, TX',
        pickupLocationType: 'Hospital',
        destination: 'Houston, TX',
        destinationLocationType: 'Funeral Home/Care Center',
        decedentName: 'John Smith',
        funeralHome: 'Peaceful Rest Funeral Home',
        status: 'In Transit',
        currentLocation: 'Huntsville, TX',
        totalCost: 485,
        actualMiles: 240,
        assignedDriver: 'Mike Johnson',
        vehicle: 'Unit 1 - Ford Transit',
        returnTo: 'Dallas, TX'
      }
    ]);

    setDrivers([
      { id: 'D001', name: 'Mike Johnson', status: 'Active', currentLocation: 'Huntsville, TX' },
      { id: 'D002', name: 'Sarah Williams', status: 'Available', currentLocation: 'Austin, TX' },
      { id: 'D003', name: 'Robert Davis', status: 'Available', currentLocation: 'Dallas, TX' }
    ]);

    setVehicles([
      { id: 'V001', name: 'Unit 1 - Ford Transit', status: 'In Use', driver: 'Mike Johnson' },
      { id: 'V002', name: 'Unit 2 - Mercedes Sprinter', status: 'Available', driver: null },
      { id: 'V003', name: 'Unit 3 - Ford Transit', status: 'Available', driver: null }
    ]);
  }, []);

  const calculateDetailedCost = (pickupType, destinationType, weight, miles) => {
    let pickupFee = 0;
    let destinationFee = 0;
    
    // Pickup fees
    if (pickupType === 'Residential') pickupFee = 225;
    else if (pickupType === 'Funeral Home/Care Center') pickupFee = 175;
    else pickupFee = 195;

    // Destination fees (same structure)
    if (destinationType === 'Residential') destinationFee = 225;
    else if (destinationType === 'Funeral Home/Care Center') destinationFee = 175;
    else destinationFee = 195;

    // Mileage fee (over 30 miles)
    const mileageFee = miles > 30 ? (miles - 30) * 3.50 : 0;

    // OB Fee (over 250 lbs)
    let obFee = 0;
    if (weight > 250) {
      obFee = 50; // Base OB fee
      const additionalWeight = weight - 250;
      const additionalHundreds = Math.floor(additionalWeight / 100);
      obFee += additionalHundreds * 50;
    }

    // Administrative fee
    const adminFee = 10;

    const totalCost = pickupFee + destinationFee + mileageFee + obFee + adminFee;

    return {
      pickupFee,
      destinationFee,
      mileageFee,
      obFee,
      adminFee,
      totalCost
    };
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const generateRequestId = () => {
    return 'REQ' + Date.now().toString().slice(-6);
  };

  const handleSubmitRequest = () => {
    const costBreakdown = calculateDetailedCost(
      formData.pickupLocationType,
      formData.destinationLocationType,
      parseInt(formData.weight) || 0,
      parseInt(formData.estimatedMiles) || 0
    );
    
    const newRequest = {
      ...formData,
      id: generateRequestId(),
      date: new Date().toISOString().split('T')[0],
      costBreakdown,
      totalCost: costBreakdown.totalCost,
      status: 'Pending Assignment',
      assignedDriver: null,
      assignedVehicle: null
    };
    
    setRequests(prev => [...prev, newRequest]);
    setFormData({
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
      estimatedMiles: 0
    });
    setShowForm(false);
    alert('Transport request submitted successfully!');
  };

  const assignDriverAndVehicle = (requestId, driverId, vehicleId) => {
    const driver = drivers.find(d => d.id === driverId);
    const vehicle = vehicles.find(v => v.id === vehicleId);
    
    setRequests(prev => prev.map(req => 
      req.id === requestId ? { 
        ...req, 
        status: 'Assigned',
        assignedDriver: driver?.name,
        assignedVehicle: vehicle?.name
      } : req
    ));
    
    alert('Driver and vehicle assigned successfully!');
  };

  const updateTransportStatus = (requestId, newStatus) => {
    setRequests(prev => prev.map(req => 
      req.id === requestId ? { ...req, status: newStatus } : req
    ));
  };

  const handleLogin = () => {
    // Simple login simulation
    if (loginData.username && loginData.password) {
      setUserRole(loginData.role);
      setIsLoggedIn(true);
      setActiveTab(loginData.role === 'funeral_home' ? 'request' : 'dashboard');
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-6 w-full max-w-md">
          <div className="text-center mb-6">
            <Truck className="w-12 h-12 text-blue-600 mx-auto mb-2" />
            <h1 className="text-xl font-bold text-gray-900">Funeral Transport Services</h1>
            <p className="text-gray-600">Professional Decedent Transportation</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={loginData.username}
                onChange={(e) => setLoginData(prev => ({...prev, username: e.target.value}))}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                placeholder="Enter username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={loginData.password}
                onChange={(e) => setLoginData(prev => ({...prev, password: e.target.value}))}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                placeholder="Enter password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={loginData.role}
                onChange={(e) => setLoginData(prev => ({...prev, role: e.target.value}))}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              >
                <option value="funeral_home">Funeral Home</option>
                <option value="employee">Employee/Driver</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            <button
              onClick={handleLogin}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700"
            >
              <LogIn className="w-4 h-4 inline mr-2" />
              Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-900 text-white p-4 shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">Funeral Transport Services</h1>
            <p className="text-blue-200 text-sm">{userRole.replace('_', ' ').toUpperCase()} Portal</p>
          </div>
          <button
            onClick={() => setIsLoggedIn(false)}
            className="text-blue-200 hover:text-white"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="flex overflow-x-auto">
          {userRole === 'funeral_home' && (
            <>
              <button
                onClick={() => setActiveTab('request')}
                className={`flex-shrink-0 py-3 px-4 text-center font-medium ${
                  activeTab === 'request' 
                    ? 'text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-500'
                }`}
              >
                <Plus className="w-4 h-4 inline mr-1" />
                New Request
              </button>
              <button
                onClick={() => setActiveTab('requests')}
                className={`flex-shrink-0 py-3 px-4 text-center font-medium ${
                  activeTab === 'requests' 
                    ? 'text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-500'
                }`}
              >
                <Clock className="w-4 h-4 inline mr-1" />
                My Requests
              </button>
            </>
          )}
          
          {(userRole === 'employee' || userRole === 'admin') && (
            <>
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex-shrink-0 py-3 px-4 text-center font-medium ${
                  activeTab === 'dashboard' 
                    ? 'text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-500'
                }`}
              >
                <Settings className="w-4 h-4 inline mr-1" />
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab('assignments')}
                className={`flex-shrink-0 py-3 px-4 text-center font-medium ${
                  activeTab === 'assignments' 
                    ? 'text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-500'
                }`}
              >
                <Users className="w-4 h-4 inline mr-1" />
                Assignments
              </button>
            </>
          )}
          
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-shrink-0 py-3 px-4 text-center font-medium ${
              activeTab === 'active' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500'
            }`}
          >
            <Truck className="w-4 h-4 inline mr-1" />
            Active Transports
          </button>
        </div>
      </div>

      <div className="p-4">
        {/* New Request Tab (Funeral Homes) */}
        {activeTab === 'request' && userRole === 'funeral_home' && (
          <div>
            {!showForm ? (
              <div className="text-center py-12">
                <Truck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-700 mb-2">Request Transport Service</h2>
                <p className="text-gray-500 mb-6">Schedule professional decedent transportation</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700"
                >
                  Create New Request
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-4">
                <h2 className="text-lg font-semibold mb-4">Transport Request Form</h2>
                
                <div className="space-y-4">
                  {/* Location Information */}
                  <div className="border-b pb-4">
                    <h3 className="font-medium text-gray-700 mb-3">Location Details</h3>
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Pickup Location</label>
                        <input
                          type="text"
                          value={formData.pickupLocation}
                          onChange={(e) => handleInputChange('pickupLocation', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter pickup address"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Pickup Location Type</label>
                        <select
                          value={formData.pickupLocationType}
                          onChange={(e) => handleInputChange('pickupLocationType', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        >
                          {locationTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Final Destination</label>
                        <input
                          type="text"
                          value={formData.destination}
                          onChange={(e) => handleInputChange('destination', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter destination address"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Destination Location Type</label>
                        <select
                          value={formData.destinationLocationType}
                          onChange={(e) => handleInputChange('destinationLocationType', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        >
                          {locationTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Estimated Miles</label>
                        <input
                          type="number"
                          value={formData.estimatedMiles}
                          onChange={(e) => handleInputChange('estimatedMiles', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          placeholder="Total trip miles"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Cost Preview */}
                  {formData.weight && formData.estimatedMiles && (
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h3 className="font-medium text-gray-700 mb-2">Cost Estimate</h3>
                      {(() => {
                        const breakdown = calculateDetailedCost(
                          formData.pickupLocationType,
                          formData.destinationLocationType,
                          parseInt(formData.weight) || 0,
                          parseInt(formData.estimatedMiles) || 0
                        );
                        return (
                          <div className="text-sm space-y-1">
                            <div className="flex justify-between">
                              <span>Pickup Fee ({formData.pickupLocationType}):</span>
                              <span>${breakdown.pickupFee}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Destination Fee ({formData.destinationLocationType}):</span>
                              <span>${breakdown.destinationFee}</span>
                            </div>
                            {breakdown.mileageFee > 0 && (
                              <div className="flex justify-between">
                                <span>Mileage Fee ({formData.estimatedMiles - 30} miles × $3.50):</span>
                                <span>${breakdown.mileageFee.toFixed(2)}</span>
                              </div>
                            )}
                            {breakdown.obFee > 0 && (
                              <div className="flex justify-between">
                                <span>OB Fee ({formData.weight} lbs):</span>
                                <span>${breakdown.obFee}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span>Administrative Fee:</span>
                              <span>${breakdown.adminFee}</span>
                            </div>
                            <div className="flex justify-between font-semibold border-t pt-1">
                              <span>Total Cost:</span>
                              <span>${breakdown.totalCost.toFixed(2)}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Decedent Information */}
                  <div className="border-b pb-4">
                    <h3 className="font-medium text-gray-700 mb-3">Decedent Information</h3>
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Full Name</label>
                        <input
                          type="text"
                          value={formData.decedentName}
                          onChange={(e) => handleInputChange('decedentName', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          placeholder="Decedent's full name"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-600 mb-1">Date of Birth</label>
                          <input
                            type="date"
                            value={formData.dateOfBirth}
                            onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-600 mb-1">Date of Death</label>
                          <input
                            type="date"
                            value={formData.dateOfDeath}
                            onChange={(e) => handleInputChange('dateOfDeath', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Weight (lbs)</label>
                        <input
                          type="number"
                          value={formData.weight}
                          onChange={(e) => handleInputChange('weight', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          placeholder="Weight in pounds"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Case Number</label>
                        <input
                          type="text"
                          value={formData.caseNumber}
                          onChange={(e) => handleInputChange('caseNumber', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          placeholder="Case reference number"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Funeral Home Information */}
                  <div className="border-b pb-4">
                    <h3 className="font-medium text-gray-700 mb-3">Funeral Home Details</h3>
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Funeral Home Name</label>
                        <input
                          type="text"
                          value={formData.funeralHomeName}
                          onChange={(e) => handleInputChange('funeralHomeName', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          placeholder="Funeral home name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Phone Number</label>
                        <input
                          type="tel"
                          value={formData.funeralHomePhone}
                          onChange={(e) => handleInputChange('funeralHomePhone', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          placeholder="(555) 123-4567"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div>
                    <h3 className="font-medium text-gray-700 mb-3">Contact Information</h3>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-600 mb-1">Pickup Contact</label>
                          <input
                            type="text"
                            value={formData.pickupContact}
                            onChange={(e) => handleInputChange('pickupContact', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            placeholder="Contact name"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-600 mb-1">Pickup Phone</label>
                          <input
                            type="tel"
                            value={formData.pickupPhone}
                            onChange={(e) => handleInputChange('pickupPhone', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            placeholder="Phone number"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-600 mb-1">Destination Contact</label>
                          <input
                            type="text"
                            value={formData.destinationContact}
                            onChange={(e) => handleInputChange('destinationContact', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            placeholder="Contact name"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-600 mb-1">Destination Phone</label>
                          <input
                            type="tel"
                            value={formData.destinationPhone}
                            onChange={(e) => handleInputChange('destinationPhone', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            placeholder="Phone number"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowForm(false)}
                    className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitRequest}
                    className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                  >
                    Submit Request
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dashboard Tab (Admin/Employee) */}
        {activeTab === 'dashboard' && (userRole === 'admin' || userRole === 'employee') && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Dashboard</h2>
            
            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="font-medium text-gray-700">Pending Requests</h3>
                <p className="text-2xl font-bold text-blue-600">{requests.filter(r => r.status === 'Pending Assignment').length}</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="font-medium text-gray-700">Active Transports</h3>
                <p className="text-2xl font-bold text-green-600">{activeTransports.length}</p>
              </div>
            </div>

            {/* Available Drivers */}
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
              </div>
            </div>

            {/* Available Vehicles */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <h3 className="font-medium text-gray-700 mb-3">Available Vehicles</h3>
              <div className="space-y-2">
                {vehicles.filter(v => v.status === 'Available').map(vehicle => (
                  <div key={vehicle.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="font-medium">{vehicle.name}</span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Available</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Assignments Tab (Admin/Employee) */}
        {activeTab === 'assignments' && (userRole === 'admin' || userRole === 'employee') && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Request Assignments</h2>
            {requests.filter(r => r.status === 'Pending Assignment').length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">No pending assignments</p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.filter(r => r.status === 'Pending Assignment').map((request) => (
                  <div key={request.id} className="bg-white rounded-lg shadow-md p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="text-sm font-mono text-gray-500">#{request.id}</span>
                        <h3 className="font-semibold text-gray-900">{request.decedentName}</h3>
                        <p className="text-sm text-gray-600">{request.funeralHomeName}</p>
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Pending Assignment
                        </span>
                        <p className="text-sm font-semibold text-gray-900 mt-1">
                          ${request.totalCost}
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-2 text-sm mb-3">
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                        <span>{request.pickupLocation} ({request.pickupLocationType}) → {request.destination} ({request.destinationLocationType})</span>
                      </div>
                      <div className="flex items-center">
                        <Weight className="w-4 h-4 text-gray-400 mr-2" />
                        <span>{request.weight} lbs • {request.estimatedMiles} miles</span>
                      </div>
                    </div>
                    
                    {userRole === 'admin' && (
                      <div className="border-t pt-3">
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Assign Driver</label>
                            <select
                              className="w-full text-sm p-2 border border-gray-300 rounded"
                              onChange={(e) => {
                                const driverId = e.target.value;
                                if (driverId) {
                                  const vehicleSelect = e.target.parentElement.parentElement.querySelector('select[data-type="vehicle"]');
                                  if (vehicleSelect.value) {
                                    assignDriverAndVehicle(request.id, driverId, vehicleSelect.value);
                                  }
                                }
                              }}
                            >
                              <option value="">Select Driver</option>
                              {drivers.filter(d => d.status === 'Available').map(driver => (
                                <option key={driver.id} value={driver.id}>{driver.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Assign Vehicle</label>
                            <select
                              data-type="vehicle"
                              className="w-full text-sm p-2 border border-gray-300 rounded"
                            >
                              <option value="">Select Vehicle</option>
                              {vehicles.filter(v => v.status === 'Available').map(vehicle => (
                                <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {userRole === 'employee' && (
                      <div className="border-t pt-3">
                        <button
                          onClick={() => updateTransportStatus(request.id, 'Accepted')}
                          className="w-full bg-green-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-700"
                        >
                          Accept Assignment
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* My Requests Tab (Funeral Homes) */}
        {activeTab === 'requests' && userRole === 'funeral_home' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">My Requests</h2>
            {requests.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">No requests submitted</p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((request) => (
                  <div key={request.id} className="bg-white rounded-lg shadow-md p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="text-sm font-mono text-gray-500">#{request.id}</span>
                        <h3 className="font-semibold text-gray-900">{request.decedentName}</h3>
                        <p className="text-sm text-gray-600">{request.funeralHomeName}</p>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          request.status === 'Pending Assignment' 
                            ? 'bg-yellow-100 text-yellow-800'
                            : request.status === 'Assigned'
                            ? 'bg-blue-100 text-blue-800'
                            : request.status === 'Confirmed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {request.status}
                        </span>
                        <p className="text-sm font-semibold text-gray-900 mt-1">
                          ${request.totalCost}
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-2 text-sm mb-3">
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                        <span>{request.pickupLocation} ({request.pickupLocationType}) → {request.destination} ({request.destinationLocationType})</span>
                      </div>
                      <div className="flex items-center">
                        <User className="w-4 h-4 text-gray-400 mr-2" />
                        <span>Case: {request.caseNumber} • {request.weight} lbs</span>
                      </div>
                      {request.assignedDriver && (
                        <div className="flex items-center">
                          <Truck className="w-4 h-4 text-blue-500 mr-2" />
                          <span>Driver: {request.assignedDriver} • Vehicle: {request.assignedVehicle}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Cost Breakdown */}
                    {request.costBreakdown && (
                      <div className="bg-gray-50 p-3 rounded text-sm">
                        <h4 className="font-medium mb-2">Cost Breakdown</h4>
                        <div className="grid grid-cols-2 gap-2">
                          <div>Pickup Fee: ${request.costBreakdown.pickupFee}</div>
                          <div>Destination Fee: ${request.costBreakdown.destinationFee}</div>
                          {request.costBreakdown.mileageFee > 0 && <div>Mileage Fee: ${request.costBreakdown.mileageFee.toFixed(2)}</div>}
                          {request.costBreakdown.obFee > 0 && <div>OB Fee: ${request.costBreakdown.obFee}</div>}
                          <div>Admin Fee: ${request.costBreakdown.adminFee}</div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Active Transports Tab */}
        {activeTab === 'active' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Active Transports</h2>
            {activeTransports.length === 0 ? (
              <div className="text-center py-8">
                <Truck className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">No active transports</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeTransports.map((transport) => (
                  <div key={transport.id} className="bg-white rounded-lg shadow-md p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="text-sm font-mono text-gray-500">#{transport.id}</span>
                        <h3 className="font-semibold text-gray-900">{transport.decedentName}</h3>
                        <p className="text-sm text-gray-600">{transport.funeralHome}</p>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          transport.status === 'In Transit' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {transport.status}
                        </span>
                        <p className="text-sm font-semibold text-gray-900 mt-1">
                          ${transport.totalCost}
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-2 text-sm">
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-gray-600">From:</span>
                        <span className="ml-2 font-medium">{transport.pickupLocation} ({transport.pickupLocationType})</span>
                      </div>
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 text-blue-500 mr-2" />
                        <span className="text-gray-600">To:</span>
                        <span className="ml-2 font-medium">{transport.destination} ({transport.destinationLocationType})</span>
                      </div>
                      <div className="flex items-center">
                        <Truck className="w-4 h-4 text-green-500 mr-2" />
                        <span className="text-gray-600">Current:</span>
                        <span className="ml-2 font-medium">{transport.currentLocation}</span>
                      </div>
                      <div className="flex items-center">
                        <User className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-gray-600">Driver:</span>
                        <span className="ml-2 font-medium">{transport.assignedDriver}</span>
                      </div>
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-gray-600">Date:</span>
                        <span className="ml-2 font-medium">{transport.date}</span>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center justify-between">
                        <div className="text-sm">
                          <span className="text-gray-600">Returns to:</span>
                          <span className="ml-2 font-medium text-blue-600">{transport.returnTo}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          Available for return pickup
                        </div>
                      </div>
                    </div>
                    
                    {(userRole === 'employee' || userRole === 'admin') && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateTransportStatus(transport.id, 'En Route')}
                            className="flex-1 bg-blue-600 text-white py-1 px-3 rounded text-sm hover:bg-blue-700"
                          >
                            <Navigation className="w-3 h-3 inline mr-1" />
                            En Route
                          </button>
                          <button
                            onClick={() => updateTransportStatus(transport.id, 'Completed')}
                            className="flex-1 bg-green-600 text-white py-1 px-3 rounded text-sm hover:bg-green-700"
                          >
                            <CheckCircle className="w-3 h-3 inline mr-1" />
                            Complete
                          </button>
                        </div>
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

export default FuneralTransportApp;