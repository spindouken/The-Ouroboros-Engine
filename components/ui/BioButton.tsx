import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import { useSoundEffects } from '../../hooks/useSoundEffects';

// Polymorphic types helper
type AsProp<C extends React.ElementType> = {
    as?: C;
};

type PropsToOmit<C extends React.ElementType, P> = keyof (AsProp<C> & P);

type PolymorphicComponentProp<C extends React.ElementType, P = {}> = React.PropsWithChildren<P & AsProp<C>> &
    Omit<React.ComponentPropsWithoutRef<C>, PropsToOmit<C, P>>;

export type BioButtonProps<C extends React.ElementType = 'button'> = PolymorphicComponentProp<C, {
    variant?: 'primary' | 'danger' | 'ghost' | 'outline' | 'tech';
    isLoading?: boolean;
    icon?: React.ReactNode;
    glow?: boolean;
}>;

const GLITCH_CHARS = '#_X-01F?@!';

export const BioButton = <C extends React.ElementType = 'button'>({
    as,
    children,
    variant = 'primary',
    isLoading = false,
    icon,
    glow = false,
    className,
    onClick,
    disabled,
    ...props
}: BioButtonProps<C>) => {
    const { playClick, playHover } = useSoundEffects();
    const [displayText, setDisplayText] = useState<React.ReactNode>(children);

    // Glitch Effect
    useEffect(() => {
        if (!isLoading) {
            setDisplayText(children);
            return;
        }

        const interval = setInterval(() => {
            const chars = Array(8).fill(0).map(() =>
                GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
            );
            setDisplayText(chars.join(''));
        }, 80);

        return () => clearInterval(interval);
    }, [isLoading, children]);

    // Update display text when children changes (if not loading)
    useEffect(() => {
        if (!isLoading) setDisplayText(children);
    }, [children, isLoading]);

    const variants = {
        primary: "bg-emerald-500/10 backdrop-blur-md text-emerald-300 border border-emerald-500/50 hover:bg-emerald-500/20 hover:text-emerald-100 hover:border-emerald-400 hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] shadow-[0_0_15px_rgba(16,185,129,0.15)]",
        danger: "bg-red-500/10 backdrop-blur-md text-red-400 border border-red-500/50 hover:bg-red-500/20 hover:text-red-200 hover:border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.15)]",
        ghost: "text-emerald-600 hover:text-emerald-300 hover:bg-emerald-500/20 border border-transparent",
        outline: "bg-transparent text-emerald-600 border border-emerald-800 hover:border-emerald-500 hover:text-emerald-400",
        tech: "bg-cyan-900/20 text-cyan-400 border border-cyan-800 hover:bg-cyan-900/40 hover:text-cyan-200"
    };

    const glowClass = glow || variant === 'primary'
        ? "shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)]"
        : "";

    const Component = as || 'button';

    return (
        <Component
            onClick={(e: React.MouseEvent) => {
                if (!disabled && !isLoading) {
                    // Only play click sound if it's acting as a button or interactive element
                    if (!as || as === 'button' || as === 'a') {
                        playClick();
                    }
                    onClick?.(e as any);
                }
            }}
            onMouseEnter={() => {
                if (!disabled && !isLoading) playHover();
            }}
            disabled={disabled || isLoading}
            className={
                clsx(
                    "relative group overflow-hidden transition-all duration-200",
                    "px-4 py-2 rounded font-bold text-xs tracking-widest uppercase flex items-center justify-center gap-2",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    variants[variant],
                    glowClass,
                    className
                )
            }
            {...props}
        >
            {/* Scanline overlay for aesthetic */}
            < div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

            {/* Loading Indicator or Icon */}
            {
                isLoading ? (
                    <span className="animate-pulse mr-2 text-current opacity-70">█</span>
                ) : icon ? (
                    <span className="flex-shrink-0">{icon}</span>
                ) : null
            }

            {/* Text Content */}
            <span className={clsx(isLoading && "font-mono")}>
                {displayText}
            </span>
        </Component >
    );
};
