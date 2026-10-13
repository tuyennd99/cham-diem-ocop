import { categories, statusOptions, type CategoryId, type StatusId } from "./data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface DossierFiltersProps {
  query: string;
  category: CategoryId;
  status: StatusId;
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: CategoryId) => void;
  onStatusChange: (value: StatusId) => void;
}

export function DossierFilters({ query, category, status, onQueryChange, onCategoryChange, onStatusChange }: DossierFiltersProps) {
  return (
    <>
      <div className="lookup-controls">
        <div className="field search-field">
          <label htmlFor="record-search">Tìm hồ sơ</label>
          <Input
            id="record-search"
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Tên, mã hồ sơ, đơn vị hoặc địa phương"
            autoComplete="off"
          />
        </div>
        <div className="field status-field">
          <label htmlFor="record-status">Trạng thái</label>
          <Select id="record-status" value={status} onChange={(event) => onStatusChange(event.target.value as StatusId)}>
            {statusOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </Select>
        </div>
      </div>

      <div className="category-filters" role="group" aria-label="Lọc theo nhóm sản phẩm">
        {categories.map((item) => (
          <Button
            key={item.id}
            type="button"
            variant={category === item.id ? "filterSelected" : "filter"}
            aria-pressed={category === item.id}
            onClick={() => onCategoryChange(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>
    </>
  );
}
