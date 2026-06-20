import { Autocomplete } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { commands, type Player } from "@/bindings";
import { query_players } from "@/utils/db";
import { unwrap } from "@/utils/unwrap";

export function PlayerSearchInput({
  label,
  value,
  file,
  rightSection,
  setValue,
}: {
  label: string;
  value?: number;
  file: string;
  rightSection?: ReactNode;
  setValue: (val: number | undefined) => void;
}) {
  const [tempValue, setTempValue] = useState("");
  const [data, setData] = useState<Player[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingQueryRef = useRef<string | null>(null);

  useEffect(() => {
    if (value !== undefined) {
      commands.getPlayer(file, value).then((res) => {
        const player = unwrap(res);
        if (player?.name) {
          setTempValue(player.name);
        }
      });
    }
  }, [value]);

  const handleChange = useCallback(
    (val: string) => {
      setTempValue(val);

      // Cancel previous debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }

      if (val.trim().length === 0) {
        setValue(undefined);
        setData([]);
        pendingQueryRef.current = null;
        return;
      }

      // Check for exact match from existing data
      const player = data.find((p) => p.name === val);
      if (player) {
        setValue(player.id);
      }

      // Mark latest query synchronously, then debounce the backend call
      pendingQueryRef.current = val;
      debounceRef.current = setTimeout(async () => {
        const res = await query_players(file, {
          name: val,
          options: {
            page: 1,
            pageSize: 5,
            skipCount: true,
            sort: "elo",
            direction: "asc",
          },
        });
        // Only apply if this is still the latest user input
        if (pendingQueryRef.current === val) {
          setData(res.data);
        }
      }, 250);
    },
    [file, data, setValue],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      pendingQueryRef.current = null;
    };
  }, []);

  return (
    <Autocomplete
      value={tempValue}
      data={data.map((player) => player.name!)}
      onChange={handleChange}
      rightSection={rightSection}
      leftSection={<IconSearch size="1rem" />}
      placeholder={label}
    />
  );
}
