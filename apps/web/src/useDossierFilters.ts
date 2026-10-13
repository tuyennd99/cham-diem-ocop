import { useEffect, useMemo, useState } from "react";
import { categories, records, statusOptions, type CategoryId, type StatusId } from "./data";

const pageSize = 4;
const categoryIds = new Set<string>(categories.map(({ id }) => id));
const statusIds = new Set<string>(statusOptions.map(({ id }) => id));

interface FilterState {
  query: string;
  category: CategoryId;
  status: StatusId;
}

function readFiltersFromUrl(): FilterState {
  const params = new URLSearchParams(window.location.search);
  const category = params.get("category");
  const status = params.get("status");

  return {
    query: params.get("q") ?? "",
    category: categoryIds.has(category ?? "") ? (category as CategoryId) : "all",
    status: statusIds.has(status ?? "") ? (status as StatusId) : "all",
  };
}

function readPageFromUrl(): number {
  const value = new URLSearchParams(window.location.search).get("page");
  const page = Number(value);
  return value && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(page) ? page : 1;
}

export function useDossierFilters() {
  const [filters, setFilters] = useState<FilterState>(readFiltersFromUrl);
  const { query, category, status } = filters;
  const [page, setPage] = useState(readPageFromUrl);

  function setQuery(query: string): void {
    setFilters((current) => ({ ...current, query }));
  }

  function setCategory(category: CategoryId): void {
    setFilters((current) => ({ ...current, category }));
  }

  function setStatus(status: StatusId): void {
    setFilters((current) => ({ ...current, status }));
  }

  useEffect(() => {
    const syncFromUrl = () => {
      setFilters(readFiltersFromUrl());
      setPage(readPageFromUrl());
    };
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  const visibleRecords = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("vi");
    return records.filter((record) => {
      const matchesCategory = category === "all" || record.category === category;
      const matchesStatus = status === "all" || record.status === status;
      const matchesQuery = !needle || [record.id, record.name, record.origin, record.applicant, record.statusLabel]
        .some((value) => value.toLocaleLowerCase("vi").includes(needle));
      return matchesCategory && matchesStatus && matchesQuery;
    });
  }, [query, category, status]);

  const pageCount = Math.max(1, Math.ceil(visibleRecords.length / pageSize));
  const currentPage = page <= pageCount ? page : 1;
  const pageRecords = visibleRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [page, currentPage]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (query) url.searchParams.set("q", query);
    else url.searchParams.delete("q");
    if (category !== "all") url.searchParams.set("category", category);
    else url.searchParams.delete("category");
    if (status !== "all") url.searchParams.set("status", status);
    else url.searchParams.delete("status");
    if (currentPage > 1) url.searchParams.set("page", String(currentPage));
    else url.searchParams.delete("page");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, [query, category, status, currentPage]);

  function changeFilters(update: () => void): void {
    setPage(1);
    update();
  }

  return {
    query, setQuery, category, setCategory, status, setStatus,
    page: currentPage, setPage, pageSize, visibleRecords, pageCount, pageRecords, changeFilters,
  };
}
