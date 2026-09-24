import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { CollectionName } from '@fsbm/shared';
import { api, ApiError } from './api';

const noRetryOn404 = (failureCount: number, error: Error) =>
  !(error instanceof ApiError && error.status === 404) && failureCount < 2;

export const useCollection = <N extends CollectionName>(name: N) =>
  useQuery({ queryKey: ['collection', name], queryFn: ({ signal }) => api.collection(name, signal) });

export const NEWS_PAGE_SIZE = 6;

/** Actualités paginées par catégorie (« Afficher plus » charge la page suivante). */
export const useNewsFeed = (category: string) =>
  useInfiniteQuery({
    queryKey: ['news', category],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => api.news({ category, limit: NEWS_PAGE_SIZE, offset: pageParam }, signal),
    getNextPageParam: (last) => (last.offset + last.items.length < last.total ? last.offset + last.items.length : undefined),
    placeholderData: keepPreviousData,
  });

export const useNewsItem = (id: string) =>
  useQuery({ queryKey: ['news-item', id], queryFn: ({ signal }) => api.newsItem(id, signal), retry: noRetryOn404 });

export const useLatestNews = (limit: number) =>
  useQuery({ queryKey: ['news', 'latest', limit], queryFn: ({ signal }) => api.news({ limit }, signal) });
