"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { AudioManager } from "@/lib/audio-manager";

export default function GalleryPage() {
  const { lang } = useLanguage();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const cardsPerPage = 12;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Query cards
  const searchResult = useQuery(api.farcasterCards.getCardsForGallery, {
    searchTerm: debouncedSearch || undefined,
    limit: cardsPerPage,
    offset: (currentPage - 1) * cardsPerPage,
  });

  const translations: Record<string, any> = {
    en: {
      title: "VibeFID Gallery",
      subtitle: "Browse all minted identity cards",
      search: "Search by name or FID...",
      sortBy: "Sort by",
      votes: "Votes",
      power: "Power",
      recent: "Recent",
      noCards: "No cards found",
      clearSearch: "Clear search",
      viewCard: "View Card",
      back: "← Back",
      page: "Page",
      of: "of",
      showing: "Showing",
      cards: "cards",
    },
    "pt-BR": {
      title: "Galeria VibeFID",
      subtitle: "Veja todos os cards mintados",
      search: "Buscar por nome ou FID...",
      sortBy: "Ordenar por",
      votes: "Votos",
      power: "Poder",
      recent: "Recentes",
      noCards: "Nenhum card encontrado",
      clearSearch: "Limpar busca",
      viewCard: "Ver Card",
      back: "← Voltar",
      page: "Página",
      of: "de",
      showing: "Mostrando",
      cards: "cards",
    },
  };

  const t = translations[lang] || translations.en;

  if (!searchResult) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-vintage-charcoal to-vintage-deep-black p-4 flex items-center justify-center">
        <div className="text-vintage-gold text-xl animate-pulse">Loading...</div>
      </div>
    );
  }

  const { cards, totalCount, hasMore } = searchResult;
  const totalPages = Math.ceil(totalCount / cardsPerPage);

  return (
    <div className="min-h-screen bg-gradient-to-b from-vintage-charcoal to-vintage-deep-black p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header - just back button */}
        <div className="mb-4">
          <Link
            href="/fid"
            onClick={() => AudioManager.buttonClick()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-vintage-charcoal border border-vintage-gold/30 text-vintage-gold rounded-lg hover:bg-vintage-gold/10 transition-colors text-sm"
          >
            {t.back}
          </Link>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t.search}
              className="w-full px-4 py-3 pl-10 bg-vintage-charcoal border border-vintage-gold/30 rounded-lg text-vintage-ice placeholder-vintage-ice/50 focus:outline-none focus:border-vintage-gold"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-vintage-ice/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-vintage-ice/50 hover:text-vintage-ice"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Cards Grid - 3 columns */}
        {cards.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 mb-6">
            {cards.map((card: any) => (
              <Link
                key={card._id}
                href={`/fid/${card.fid}`}
                onClick={() => AudioManager.buttonClick()}
                className="bg-vintage-charcoal rounded-xl border border-vintage-gold/30 overflow-hidden hover:border-vintage-gold hover:scale-105 transition-all group"
              >
                {/* Card Image */}
                <div className="aspect-[3/4] relative">
                  <img
                    src={card.cardImageUrl}
                    alt={card.username}
                    className="w-full h-full object-cover"
                  />

                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-t from-vintage-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                    <span className="text-vintage-gold text-sm font-bold">
                      {t.viewCard} →
                    </span>
                  </div>

                </div>

                {/* Card Info */}
                <div className="p-3">
                  <p className="text-vintage-gold font-bold truncate">
                    @{card.username}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-vintage-ice text-lg mb-4">{t.noCards}</p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="px-4 py-2 bg-vintage-gold/20 border border-vintage-gold/30 text-vintage-gold rounded-lg hover:bg-vintage-gold/30"
              >
                {t.clearSearch}
              </button>
            )}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={() => {
                AudioManager.buttonClick();
                setCurrentPage((prev) => Math.max(1, prev - 1));
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-vintage-charcoal border border-vintage-gold/30 text-vintage-gold rounded-lg hover:bg-vintage-gold/10 disabled:opacity-50"
            >
              ←
            </button>

            <span className="text-vintage-ice px-4">
              {t.page} {currentPage} {t.of} {totalPages}
            </span>

            <button
              onClick={() => {
                AudioManager.buttonClick();
                setCurrentPage((prev) => Math.min(totalPages, prev + 1));
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-vintage-charcoal border border-vintage-gold/30 text-vintage-gold rounded-lg hover:bg-vintage-gold/10 disabled:opacity-50"
            >
              →
            </button>
          </div>
        )}

        {/* Total count */}
        {totalCount > 0 && (
          <p className="text-center text-vintage-ice/50 text-sm mt-4 mb-20">
            {t.showing} {cards.length} {t.of} {totalCount} {t.cards}
          </p>
        )}

        {/* Spacer for bottom nav */}
        <div className="h-20"></div>
      </div>

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-[9999] safe-area-bottom">
        <div className="bg-vintage-charcoal/95 backdrop-blur-lg rounded-none border-t-2 border-vintage-gold/30 p-1 flex gap-1">
          <Link
            href="/fid"
            onClick={() => AudioManager.buttonClick()}
            className="flex-1 min-w-0 px-1 py-2 flex flex-col items-center justify-center gap-0.5 rounded-lg font-semibold transition-all text-[10px] leading-tight bg-vintage-black text-vintage-gold hover:bg-vintage-gold/10 border border-vintage-gold/30"
          >
            <span className="text-[10px] font-bold whitespace-nowrap">Play</span>
            <span className="text-xl leading-none">♠</span>
          </Link>
          <div className="flex-1 min-w-0 px-1 py-2 flex flex-col items-center justify-center gap-0.5 rounded-lg font-semibold text-[10px] leading-tight bg-vintage-gold/20 text-vintage-gold border-2 border-vintage-gold">
            <span className="text-[10px] font-bold whitespace-nowrap">Gallery</span>
            <span className="text-xl leading-none">♦</span>
          </div>
          <Link
            href="/fid"
            onClick={() => AudioManager.buttonClick()}
            className="flex-1 min-w-0 px-1 py-2 flex flex-col items-center justify-center gap-0.5 rounded-lg font-semibold transition-all text-[10px] leading-tight bg-vintage-black text-vintage-gold hover:bg-vintage-gold/10 border border-vintage-gold/30"
          >
            <span className="text-[10px] font-bold whitespace-nowrap">About</span>
            <span className="text-xl leading-none">♣</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
