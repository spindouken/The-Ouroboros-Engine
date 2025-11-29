import { useState, useEffect } from 'react';
import { OuroborosEngine, EngineState } from '../engine/OuroborosEngine';

export const useEngine = () => {
    const engine = OuroborosEngine.getInstance();
    const [state, setState] = useState<EngineState>(engine.getState());

    useEffect(() => {
        const unsubscribe = engine.subscribe((newState) => {
            setState({ ...newState });
        });
        return unsubscribe;
    }, []);

    return {
        state,
        engine
    };
};
