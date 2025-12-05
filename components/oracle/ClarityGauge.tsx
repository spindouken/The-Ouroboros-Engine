import React from 'react';

interface ClarityGaugeProps {
    score: number;
}

export const ClarityGauge: React.FC<ClarityGaugeProps> = ({ score }) => {
    const radius = 20;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;

    let color = '#ef4444'; // Red
    if (score >= 40) color = '#eab308'; // Yellow
    if (score >= 70) color = '#22c55e'; // Green

    return (
        <div className="flex flex-col items-center justify-center mr-4">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap leading-none mb-1">
                Clarity Score
            </span>
            <div className="relative w-12 h-12 flex items-center justify-center">
                <svg className="transform -rotate-90 w-12 h-12 block">
                    <circle
                        cx="24"
                        cy="24"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="transparent"
                        className="text-gray-700"
                    />
                    <circle
                        cx="24"
                        cy="24"
                        r={radius}
                        stroke={color}
                        strokeWidth="4"
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        className="transition-all duration-500 ease-out"
                    />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white leading-none pt-0.5">
                    {Math.round(score)}%
                </span>
            </div>
        </div>
    );
};
