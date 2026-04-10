import React, { useState, useEffect, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import './App.css';

export default function App() {
  const [currentPlate, setCurrentPlate] = useLocalStorage('plate_obsidian', []);
  const [icr, setIcr] = useLocalStorage('icr', 10);
  const [isf, setIsf] = useLocalStorage('isf', 50);
  const [targetBg, setTargetBg] = useLocalStorage('target', 100);

  const [currentBg, setCurrentBg] = useState('');
  const [iob, setIob] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedFood, setSelectedFood] = useState(null);
  const [portionGrams, setPortionGrams] = useState(100);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCarbs, setCustomCarbs] = useState('');
  const [customKcal, setCustomKcal] = useState('');
  const [customPortion, setCustomPortion] = useState(100);

  // --- AUTO-SUGGEST ENGINE ---
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length > 2 && !selectedFood) {
        setIsSearching(true);
        fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${import.meta.env.VITE_USDA_API_KEY}&query=${searchQuery}&pageSize=6`)
          .then(res => res.json())
          .then(data => {
            setSuggestions(data.foods.map(f => ({
              id: f.fdcId, name: f.description, 
              carbs: f.foodNutrients.find(n => n.nutrientName.toLowerCase().includes('carbohydrate'))?.value || 0,
              kcal: f.foodNutrients.find(n => n.nutrientName.toLowerCase().includes('energy'))?.value || 0
            })));
          })
          .catch(e => console.error(e))
          .finally(() => setIsSearching(false));
      } else {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedFood]);

  const totals = useMemo(() => currentPlate.reduce((acc, i) => ({
    carbs: acc.carbs + (Number(i.carbs) || 0),
    kcal: acc.kcal + (Number(i.kcal) || 0)
  }), { carbs: 0, kcal: 0 }), [currentPlate]);

  const bolus = useMemo(() => {
    const m = totals.carbs / (Number(icr) || 10);
    const c = (Number(currentBg) > targetBg) ? (Number(currentBg) - targetBg) / (Number(isf) || 50) : 0;
    return Math.round(Math.max(0, m + c - (Number(iob) || 0)) * 2) / 2;
  }, [totals, icr, currentBg, targetBg, isf, iob]);

  return (
    <div className="app-container">
      
      {/* 1. HERO DASHBOARD */}
      <div className="glass-card dashboard-hero">
        <span className="label-tiny">Recommended Units</span>
        <h1 className="huge-display">{bolus.toFixed(1)}<span style={{fontSize: '1.5rem', opacity: 0.3}}>U</span></h1>
        <div className="divider" />
        <div className="grid-2">
          <div><span className="label-tiny">Glucides</span><div style={{fontSize:'20px', fontWeight:700}}>{totals.carbs.toFixed(1)}g</div></div>
          <div><span className="label-tiny">Kcal</span><div style={{fontSize:'20px', fontWeight:700}}>{Math.round(totals.kcal)}</div></div>
        </div>
      </div>

      {/* 2. VITALS GRID */}
      <div className="grid-2">
        <div className="glass-card">
          <span className="label-tiny">Glucose</span>
          <input type="number" value={currentBg} onChange={e => setCurrentBg(e.target.value)} placeholder="Blood Glucose (mg/dL)" />
        </div>
        <div className="glass-card">
          <span className="label-tiny">Insulin on Board</span>
          <input type="number" value={iob} onChange={e => setIob(e.target.value)} placeholder="Insulin on Board (units)" />
        </div>
      </div>

      {/* 3. SEARCH & SUGGEST */}
      <div className="glass-card">
        <span className="label-tiny">Food Search</span>
        <input 
          type="text" placeholder="Start typing..." value={searchQuery}
          style={{borderColor: isSearching ? 'var(--accent)' : 'var(--border)'}}
          onChange={e => { setSearchQuery(e.target.value); setSelectedFood(null); }}
        />
        
        {suggestions.length > 0 && !selectedFood && (
          <div style={{marginTop:'12px', background:'#1c1c1e', borderRadius:'18px', border:'1px solid var(--border)', overflow:'hidden'}}>
            {suggestions.map(s => (
              <div key={s.id} onClick={() => setSelectedFood(s)} style={{padding:'16px', borderBottom:'1px solid var(--border)', cursor:'pointer'}}>
                <div style={{fontSize:'14px', fontWeight:600}}>{s.name}</div>
                <div style={{fontSize:'11px', color:'var(--accent)'}}>{s.carbs.toFixed(1)}g Carbs/100g</div>
              </div>
            ))}
          </div>
        )}

        {searchQuery.length > 2 && !selectedFood && !isSearching && suggestions.length === 0 && (
          <div style={{marginTop:'16px', padding:'18px', background:'#19191b', borderRadius:'18px', border:'1px solid var(--border)'}}>
            {!showCustomForm ? (
              <button className="btn-add" style={{width:'100%'}} onClick={() => {
                setCustomName(searchQuery);
                setCustomCarbs('');
                setCustomKcal('');
                setCustomPortion(100);
                setShowCustomForm(true);
              }}>
                Add custom food
              </button>
            ) : (
              <div style={{display:'grid', gap:'12px'}}>
                <input type="text" value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Food name" style={{width:'100%'}} />
                <input type="number" value={customCarbs} onChange={e => setCustomCarbs(e.target.value)} placeholder="Carbs per 100g" style={{width:'100%'}} />
                <input type="number" value={customKcal} onChange={e => setCustomKcal(e.target.value)} placeholder="Calories per 100g" style={{width:'100%'}} />
                <input type="number" value={customPortion} onChange={e => setCustomPortion(e.target.value)} placeholder="Portion (grams)" style={{width:'100%'}} />
                <div style={{display:'flex', gap:'10px'}}>
                  <button className="btn-add" style={{flex:1}} onClick={() => {
                    const carbs = Number(customCarbs) || 0;
                    const kcal = Number(customKcal) || 0;
                    const portion = Number(customPortion) || 100;
                    const factor = portion / 100;
                    setCurrentPlate([...currentPlate, {
                      id: Date.now(),
                      name: customName || searchQuery,
                      carbs: carbs * factor,
                      kcal: kcal * factor,
                      weight: portion
                    }]);
                    setShowCustomForm(false);
                    setSearchQuery('');
                    setCustomName('');
                    setCustomCarbs('');
                    setCustomKcal('');
                    setCustomPortion(100);
                  }}>
                    Add product
                  </button>
                  <button style={{flex:1, background:'none', border:'1px solid var(--border)', borderRadius:'16px', color:'#ff453a'}} onClick={() => setShowCustomForm(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {selectedFood && (
          <div style={{marginTop: '20px', padding: '20px', background: 'rgba(0,122,255,0.08)', borderRadius: '22px', border: '1px solid var(--accent)'}}>
            <div style={{fontSize: '13px', fontWeight: 700, marginBottom: '16px'}}>{selectedFood.name}</div>
            <div style={{display:'flex', gap:'12px'}}>
              <input style={{flex:1}} type="number" value={portionGrams} onChange={e => setPortionGrams(e.target.value)} placeholder="Portion (grams)" />
              <button className="btn-add" onClick={() => {
                const mult = portionGrams / 100;
                setCurrentPlate([...currentPlate, { id: Date.now(), name: selectedFood.name, carbs: selectedFood.carbs * mult, kcal: selectedFood.kcal * mult, weight: portionGrams }]);
                setSelectedFood(null); setSearchQuery('');
              }}>Add</button>
            </div>
          </div>
        )}
      </div>

      {/* 4. MEAL LIST */}
      {currentPlate.length > 0 && (
        <div className="glass-card">
          <div style={{display:'flex', justifyContent:'space-between', marginBottom:'16px'}}>
            <span className="label-tiny">Current Meal</span>
            <button onClick={() => setCurrentPlate([])} style={{background:'none', border:'none', color:'#ff453a', fontSize:'11px', fontWeight:700}}>CLEAR</button>
          </div>
          <div className="plate-scroll">
            {currentPlate.map(item => (
              <div key={item.id} style={{display:'flex', justifyContent:'space-between', padding:'12px 0', borderBottom:'1px solid var(--border)'}}>
                <div style={{flex:1}}><div style={{fontSize:'14px', fontWeight:600}}>{item.weight}g {item.name}</div><div style={{fontSize:'11px', color:'var(--text-dim)'}}>{Math.round(item.kcal)} kcal</div></div>
                <div style={{display:'flex', alignItems:'center', gap:'16px'}}><span style={{fontWeight:700, color:'var(--accent)'}}>{item.carbs.toFixed(1)}g</span><button onClick={() => setCurrentPlate(currentPlate.filter(i => i.id !== item.id))} style={{background:'none', border:'none', color:'#ff453a', fontSize:'20px'}}>×</button></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. CONFIG GRID */}
      <div className="glass-card grid-3" style={{padding:'16px'}}>
        <div><span className="label-tiny">ICR</span><input style={{padding:'16px', textAlign:'center', fontSize:'14px'}} type="number" value={icr} onChange={e => setIcr(e.target.value)} placeholder="Insulin-to-Carb Ratio (g/U)" /></div>
        <div><span className="label-tiny">ISF</span><input style={{padding:'16px', textAlign:'center', fontSize:'14px'}} type="number" value={isf} onChange={e => setIsf(e.target.value)} placeholder="Insulin Sensitivity Factor (mg/dL/U)" /></div>
        <div><span className="label-tiny">Target</span><input style={{padding:'16px', textAlign:'center', fontSize:'14px'}} type="number" value={targetBg} onChange={e => setTargetBg(e.target.value)} placeholder="Target Blood Glucose (mg/dL)" /></div>
      </div>

    </div>
  );
}