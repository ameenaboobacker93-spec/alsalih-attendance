import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';

const BranchContext = createContext(null);

export function BranchProvider({ children }) {
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadBranches();
  }, []);

  async function loadBranches() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('name');

      if (error) throw error;
      setBranches(data || []);
    } catch (err) {
      console.error('Failed to load branches:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <BranchContext.Provider value={{
      branches,
      selectedBranch,
      setSelectedBranch,
      loading,
      error,
    }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranch must be used within BranchProvider');
  return ctx;
}
