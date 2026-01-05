'use client';

import type { Transition, Variants } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { motion, useAnimation } from 'motion/react';

import { cn } from '@/lib/utils';

export interface ClockIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface ClockIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  animateOnLoad?: boolean;
}

const HAND_TRANSITION: Transition = {
  duration: 0.6,
  ease: [0.4, 0, 0.2, 1],
};

const HAND_VARIANTS: Variants = {
  initial: {
    rotate: 0,
    originX: '0%',
    originY: '100%',
    opacity: 0.5,
  },
  normal: {
    rotate: 0,
    originX: '0%',
    originY: '100%',
    opacity: 1,
  },
  animate: {
    rotate: 360,
    originX: '0%',
    originY: '100%',
    opacity: 1,
  },
};

const MINUTE_HAND_TRANSITION: Transition = {
  duration: 0.5,
  ease: 'easeInOut',
};

const MINUTE_HAND_VARIANTS: Variants = {
  initial: {
    rotate: 0,
    originX: '0%',
    originY: '100%',
    opacity: 0.5,
  },
  normal: {
    rotate: 0,
    originX: '0%',
    originY: '100%',
    opacity: 1,
  },
  animate: {
    rotate: 45,
    originX: '0%',
    originY: '100%',
    opacity: 1,
  },
};

const ClockIcon = forwardRef<ClockIconHandle, ClockIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 28, animateOnLoad = false, ...props }, ref) => {
    const controls = useAnimation();
    const isControlledRef = useRef(false);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;

      return {
        startAnimation: () => controls.start('animate'),
        stopAnimation: () => controls.start('normal'),
      };
    });

    useEffect(() => {
      if (animateOnLoad) {
        const timer = setTimeout(() => {
          controls.start('animate');
        }, 100);
        return () => clearTimeout(timer);
      }
    }, [animateOnLoad, controls]);

    const handleMouseEnter = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isControlledRef.current) {
          controls.start('animate');
        } else {
          onMouseEnter?.(e);
        }
      },
      [controls, onMouseEnter]
    );

    const handleMouseLeave = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isControlledRef.current) {
          controls.start('normal');
        } else {
          onMouseLeave?.(e);
        }
      },
      [controls, onMouseLeave]
    );

    return (
      <div
        className={cn(className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <motion.line
            x1="12"
            y1="12"
            x2="12"
            y2="6"
            variants={HAND_VARIANTS}
            animate={controls}
            initial={animateOnLoad ? 'initial' : 'normal'}
            transition={HAND_TRANSITION}
          />
          <motion.line
            x1="12"
            y1="12"
            x2="16"
            y2="12"
            variants={MINUTE_HAND_VARIANTS}
            animate={controls}
            initial={animateOnLoad ? 'initial' : 'normal'}
            transition={MINUTE_HAND_TRANSITION}
          />
        </svg>
      </div>
    );
  }
);

ClockIcon.displayName = 'ClockIcon';

export { ClockIcon };
