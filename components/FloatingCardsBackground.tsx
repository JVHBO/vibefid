"use client";

import { useEffect, useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

interface FloatingCard {
  id: string;
  fid: number;
  imageUrl: string;
  x: number;
  duration: number;
  delay: number; // Delay em segundos antes de começar a animação
}

export function FloatingCardsBackground() {
  const [floatingCards, setFloatingCards] = useState<FloatingCard[]>([]);

  const recentCards = useQuery(api.farcasterCards.getCardImagesOnly, {
    limit: 8,
  });

  useEffect(() => {
    if (recentCards && recentCards.length > 0) {
      // Função para gerar número aleatório em range
      const random = (min: number, max: number) => Math.random() * (max - min) + min;

      const numCards = Math.min(8, recentCards.length);

      // Dividir a tela horizontalmente em seções (uma por carta)
      const sectionWidth = 100 / numCards;

      const cards = recentCards.slice(0, numCards).map((card: any, index: number) => {
        // Calcular a seção horizontal desta carta
        const sectionStart = index * sectionWidth;
        // Posição X com variação dentro da seção (margem de 2% nas bordas)
        const x = sectionStart + random(2, sectionWidth - 2);

        // Delay escalonado para não começarem todas juntas
        // Delays mais curtos para aparecer mais rápido
        const delay = index === 0 ? 0 : (index * 3) + random(0, 1);

        return {
          id: card._id || `card-${index}`,
          fid: card.fid,
          imageUrl: card.cardImageUrl || card.pfpUrl,
          x,
          duration: random(25, 35),
          delay, // Delay em segundos
        };
      });

      setFloatingCards(cards);
    }
  }, [recentCards]);

  // Memoize keyframes CSS to avoid re-renders
  const keyframesCSS = useMemo(() => {
    return floatingCards.map((_, index) => `
      @keyframes floatUp${index} {
        0% { transform: translateY(0) translateZ(0); }
        100% { transform: translateY(-150vh) translateZ(0); }
      }
    `).join('\n');
  }, [floatingCards.length]);

  if (floatingCards.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'auto',
        overflow: 'hidden',
        zIndex: 0,
      }}
    >
      {floatingCards.map((card, index) => (
        <div
          key={card.id}
          onClick={() => window.location.href = `/fid/${card.fid}`}
          style={{
            position: 'absolute',
            width: '140px',
            height: '196px',
            cursor: 'pointer',
            left: `${card.x}%`,
            marginLeft: '-70px',
            top: 'calc(100% + 220px)', // Sempre começa abaixo da tela
            backgroundColor: '#0a0a0a',
            borderRadius: '12px',
            overflow: 'hidden',
            zIndex: index + 1,
            willChange: 'transform',
            animation: `floatUp${index} ${card.duration}s linear ${card.delay}s infinite`,
          }}
        >
          <img
            src={card.imageUrl}
            alt=""
            loading="lazy"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              filter: 'brightness(0.35)',
              transition: 'filter 0.3s ease',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLImageElement).style.filter = 'brightness(0.6)';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLImageElement).style.filter = 'brightness(0.35)';
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      ))}

      <style jsx global>{`
        ${keyframesCSS}
      `}</style>
    </div>
  );
}

export default FloatingCardsBackground;
