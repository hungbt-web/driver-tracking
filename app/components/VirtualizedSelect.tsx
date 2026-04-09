"use client";

import * as React from "react";
import { Autocomplete, TextField } from "@mui/material";

type VirtualizedSelectProps = {
  label: string;
  options: Array<{
    value: string;
    label: string;
    isError?: boolean;
  }>;
  value: string;
  onChange: (value: string) => void;
  width?: number;
};

const LISTBOX_PADDING = 8;
const ITEM_HEIGHT = 40;
const MAX_VISIBLE_ITEMS = 8;

const ListboxComponent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLElement>
>(function ListboxComponent(props, ref) {
  const { children, ...other } = props;
  const domSafeProps = {
    ...other,
  } as React.HTMLAttributes<HTMLElement> & {
    ownerState?: unknown;
  };
  delete domSafeProps.ownerState;
  const itemData = React.Children.toArray(children) as React.ReactElement<{
    style?: React.CSSProperties;
  }>[];
  const itemCount = itemData.length;
  const viewportHeight =
    Math.min(MAX_VISIBLE_ITEMS, Math.max(1, itemCount)) * ITEM_HEIGHT;
  const [scrollTop, setScrollTop] = React.useState(0);

  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - 2);
  const endIndex = Math.min(
    itemCount,
    Math.ceil((scrollTop + viewportHeight) / ITEM_HEIGHT) + 2
  );
  const visibleItems = itemData.slice(startIndex, endIndex);

  return (
    <div
      ref={ref}
      {...domSafeProps}
      onScroll={(event) =>
        setScrollTop((event.target as HTMLDivElement).scrollTop)
      }
      style={{
        maxHeight: viewportHeight + 2 * LISTBOX_PADDING,
        overflowY: "auto",
      }}
    >
      <div
        style={{
          height: itemCount * ITEM_HEIGHT + 2 * LISTBOX_PADDING,
          position: "relative",
        }}
      >
        {visibleItems.map((child, localIndex) => {
          const index = startIndex + localIndex;
          return React.cloneElement(child, {
            style: {
              ...child.props.style,
              position: "absolute",
              top: LISTBOX_PADDING + index * ITEM_HEIGHT,
              height: ITEM_HEIGHT,
              padding: "10px 16px",
              width: "100%",
              boxSizing: "border-box",
            },
          });
        })}
      </div>
    </div>
  );
});

export default function VirtualizedSelect({
  label,
  options,
  value,
  onChange,
  width = 280,
}: VirtualizedSelectProps) {
  const selectedOption =
    options.find((option) => option.value === value) ?? null;

  return (
    <Autocomplete
      disablePortal
      value={selectedOption}
      options={options}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, current) => option.value === current.value}
      onChange={(_, nextValue) => onChange(nextValue?.value ?? "")}
      slots={{
        listbox: ListboxComponent as React.ComponentType<
          React.HTMLAttributes<HTMLElement>
        >,
      }}
      sx={{ width }}
      renderOption={(props, option) => {
        const { key, ...rest } = props;
        return (
          <li
            key={key}
            {...rest}
            style={{
              ...(props.style ?? {}),
              color: option.isError ? "#d32f2f" : "#333333",
              fontWeight: option.isError ? 600 : 400,
            }}
          >
            {option.label}
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField {...params} size="small" label={label} />
      )}
    />
  );
}
