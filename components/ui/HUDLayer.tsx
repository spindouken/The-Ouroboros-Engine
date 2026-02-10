import React from 'react';
import { useOuroborosStore } from '../../store/ouroborosStore';
import { HoloStamp } from './HoloStamp';
import { AnimatePresence } from 'framer-motion';

export const HUDLayer: React.FC = () => {
    const { alerts, removeAlert } = useOuroborosStore();

    const errorAlerts = alerts.filter(a => a.type === 'error');
    const standardAlerts = alerts.filter(a => a.type !== 'error');

    return (
        <div className="absolute inset-0 z-[100] pointer-events-none overflow-hidden">
            {/* Standard Notifications (Top Right, pushed down) */}
            <div className="absolute top-0 right-0 p-8 pt-32 flex flex-col items-end gap-4 w-full max-w-sm pointer-events-none">
                <AnimatePresence>
                    {standardAlerts.map(alert => (
                        <div key={alert.id} className="pointer-events-auto">
                            <HoloStamp
                                alert={alert}
                                onDismiss={removeAlert}
                            />
                        </div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Critical Errors (Center Screen) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <AnimatePresence>
                    {errorAlerts.map(alert => (
                        <div key={alert.id} className="pointer-events-auto">
                            <HoloStamp
                                alert={alert}
                                onDismiss={removeAlert}
                            />
                        </div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
};
