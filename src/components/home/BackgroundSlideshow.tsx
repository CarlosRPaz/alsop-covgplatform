'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

const images = [
    '/images/home-bg-1.png',
    '/images/home-bg-2.png',
    '/images/home-bg-3.png',
    '/images/home-bg-4.png',
    '/images/home-bg-5.png',
];

export function BackgroundSlideshow() {
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        console.log('BackgroundSlideshow mounted');
        const interval = setInterval(() => {
            setCurrentIndex((prev) => {
                const newIndex = (prev + 1) % images.length;
                console.log('Slideshow changing to index:', newIndex);
                return newIndex;
            });
        }, 8000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 1,
                overflow: 'hidden',
                backgroundColor: '#1e293b', // Fallback background
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'radial-gradient(circle at center, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.6) 100%)',
                    zIndex: 2,
                }}
            />
            {images.map((src, index) => (
                <div
                    key={src}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        opacity: index === currentIndex ? 1 : 0,
                        transition: 'opacity 1.5s ease-in-out',
                        zIndex: 0,
                    }}
                >
                    <Image
                        src={src}
                        alt="Cozy home background"
                        fill
                        style={{ objectFit: 'cover' }}
                        quality={75}
                        priority={index === 0}
                    />
                </div>
            ))}
        </div>
    );
}
