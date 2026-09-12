import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import API from '../services/api';
import { useAuth } from './AuthContext';

const FarmContext = createContext(null);

export const FarmProvider = ({ children }) => {
  const { user, updateProfile } = useAuth();
  const [farms, setFarms] = useState([]);
  const [archivedFarms, setArchivedFarms] = useState([]);
  const [activeFarm, setActiveFarmState] = useState(null);
  const [loading, setLoading] = useState(false);
  const userId = user?.id || user?._id;
  const isFetchingRef = React.useRef(false);

  const refreshFarms = useCallback(async () => {
    if (!userId) {
      setFarms([]);
      setActiveFarmState(null);
      return;
    }
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    try {
      // Parallel fetch all farms, archived farms, and active farm
      const [listRes, archivedRes, activeRes] = await Promise.all([
        API.get('/api/farms'),
        API.get('/api/farms/archived'),
        API.get('/api/farms/current')
      ]);
      setFarms(listRes.data || []);
      setArchivedFarms(archivedRes.data || []);
      setActiveFarmState(activeRes.data || null);
    } catch (error) {
      console.error("Error refreshing farms context:", error);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [userId]);

  // Load farms once when user shifts
  useEffect(() => {
    if (userId) {
      refreshFarms();
    }
  }, [userId, refreshFarms]);

  const selectActiveFarm = async (farmId) => {
    setLoading(true);
    try {
      const res = await API.post(`/api/farms/${farmId}/select`);
      // Update local active farm state
      const farmDoc = farms.find(f => f.id === farmId);
      if (farmDoc) {
        setActiveFarmState(farmDoc);
        // Force refresh user context to update farm_profile_completed if needed
        if (user && !user.farm_profile_completed) {
          await updateProfile({ farm_profile_completed: true, active_farm_id: farmId });
        }
      }
      return res.data;
    } catch (error) {
      console.error("Error setting active farm:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const createFarm = async (farmData) => {
    setLoading(true);
    try {
      const res = await API.post('/api/farms', farmData);
      const newFarm = res.data;
      setFarms(prev => [...prev, newFarm]);
      setActiveFarmState(newFarm);
      
      // Update user auth profile context
      if (user) {
        await updateProfile({ farm_profile_completed: true, active_farm_id: newFarm.id });
      }
      return newFarm;
    } catch (error) {
      console.error("Error creating farm:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateFarm = async (farmId, farmData) => {
    setLoading(true);
    try {
      const res = await API.put(`/api/farms/${farmId}`, farmData);
      const updatedFarm = res.data;
      setFarms(prev => prev.map(f => f.id === farmId ? updatedFarm : f));
      if (activeFarm && activeFarm.id === farmId) {
        setActiveFarmState(updatedFarm);
      }
      return updatedFarm;
    } catch (error) {
      console.error("Error updating farm:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteFarm = async (farmId) => {
    setLoading(true);
    try {
      await API.delete(`/api/farms/${farmId}`);
      setFarms(prev => prev.filter(f => f.id !== farmId));
      
      // If deleted farm was active, set active to another or clear it
      if (activeFarm && activeFarm.id === farmId) {
        const remaining = farms.filter(f => f.id !== farmId);
        if (remaining.length > 0) {
          setActiveFarmState(remaining[0]);
          if (user) {
            await updateProfile({ active_farm_id: remaining[0].id });
          }
        } else {
          setActiveFarmState(null);
          if (user) {
            await updateProfile({ active_farm_id: null, farm_profile_completed: false });
          }
        }
      }
      await refreshFarms();
    } catch (error) {
      console.error("Error deleting farm:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const unarchiveFarm = async (farmId) => {
    setLoading(true);
    try {
      await API.post(`/api/farms/${farmId}/unarchive`);
      await refreshFarms();
      return true;
    } catch (error) {
      console.error("Error unarchiving farm:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const profileCompleted = !!(user && user.farm_profile_completed);

  return (
    <FarmContext.Provider value={{
      farms,
      archivedFarms,
      activeFarm,
      loading,
      profileCompleted,
      refreshFarms,
      setActiveFarm: selectActiveFarm,
      createFarm,
      updateFarm,
      deleteFarm,
      unarchiveFarm
    }}>
      {children}
    </FarmContext.Provider>
  );
};

export const useFarm = () => {
  const context = useContext(FarmContext);
  if (!context) {
    return { farms: [], activeFarm: null, loading: false, refreshFarms: () => {}, selectActiveFarm: () => {} };
  }
  return context;
};
