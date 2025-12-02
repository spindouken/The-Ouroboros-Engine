import { useLiveQuery } from 'dexie-react-hooks';
import useSound from 'use-sound';
import { db } from '../db/ouroborosDB';

// Placeholder sound URLs - in a real app these would be local files or hosted assets
const SOUNDS = {
    click: '/sounds/click.mp3',
    hover: '/sounds/hover.mp3',
    success: '/sounds/success.mp3',
    error: '/sounds/error.mp3',
    boot: '/sounds/boot.mp3',
};

export const useSoundEffects = () => {
    const settings = useLiveQuery(() => db.settings.get(1));
    const enabled = settings?.enableSoundEffects ?? true;

    const [playClick] = useSound(SOUNDS.click, { volume: 0.5, soundEnabled: enabled });
    const [playHover] = useSound(SOUNDS.hover, { volume: 0.1, soundEnabled: enabled });
    const [playSuccess] = useSound(SOUNDS.success, { volume: 0.5, soundEnabled: enabled });
    const [playError] = useSound(SOUNDS.error, { volume: 0.5, soundEnabled: enabled });
    const [playBoot] = useSound(SOUNDS.boot, { volume: 0.7, soundEnabled: enabled });

    return {
        playClick,
        playHover,
        playSuccess,
        playError,
        playBoot
    };
};
