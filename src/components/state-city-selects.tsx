"use client";

import { useEffect, useMemo, useState } from "react";
import { Field, Input, Select } from "@/components/ui/form";

const INDIA_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

const CITY_DATA_STATE_ALIASES: Record<string, string[]> = {
  "Dadra and Nagar Haveli and Daman and Diu": [
    "Dadra and Nagar Haveli",
    "Daman and Diu",
  ],
  Puducherry: ["Pondicherry"],
};

export function StateCitySelects({
  stateName = "state",
  cityName = "city",
  defaultState = "",
  defaultCity = "",
  required = false,
}: {
  stateName?: string;
  cityName?: string;
  defaultState?: string | null;
  defaultCity?: string | null;
  required?: boolean;
}) {
  const initialState = defaultState ?? "";
  const initialCity = defaultCity ?? "";
  const states = useMemo(() => {
    const listed: string[] = [...INDIA_STATES];
    return initialState && !listed.includes(initialState)
      ? [...listed, initialState].sort((a, b) => a.localeCompare(b))
      : listed;
  }, [initialState]);
  const [selectedState, setSelectedState] = useState(initialState);
  const [selectedCity, setSelectedCity] = useState(initialCity);
  const [cities, setCities] = useState<string[]>(initialCity ? [initialCity] : []);
  const [loadingCities, setLoadingCities] = useState(Boolean(initialState));
  const [cityLoadFailed, setCityLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;
    if (!selectedState) {
      setCities([]);
      setLoadingCities(false);
      setCityLoadFailed(false);
      return () => { active = false; };
    }

    setLoadingCities(true);
    setCityLoadFailed(false);
    void import("countrycitystatejson/client")
      .then(async ({ getCities }) => {
        const providerStates = CITY_DATA_STATE_ALIASES[selectedState] ?? [selectedState];
        const groups = await Promise.all(
          providerStates.map((state) => getCities("IN", state)),
        );
        return Array.from(new Set(groups.flatMap((group) => group ?? []))).sort(
          (a, b) => a.localeCompare(b),
        );
      })
      .then((items) => {
        if (!active) return;
        if (!items.length) throw new Error("No cities are available for this state.");
        const listed = items;
        const preservedCity = selectedState === initialState ? initialCity : "";
        setCities(
          preservedCity && !listed.includes(preservedCity)
            ? [preservedCity, ...listed]
            : listed,
        );
      })
      .catch(() => {
        if (active) setCityLoadFailed(true);
      })
      .finally(() => {
        if (active) setLoadingCities(false);
      });

    return () => { active = false; };
  }, [initialCity, initialState, selectedState]);

  return (
    <>
      <Field label="State" required={required}>
        <Select
          name={stateName}
          required={required}
          value={selectedState}
          onChange={(event) => {
            setSelectedState(event.target.value);
            setSelectedCity("");
            setCities([]);
          }}
        >
          <option value="">Select state</option>
          {states.map((state) => (
            <option key={state} value={state}>{state}</option>
          ))}
        </Select>
      </Field>
      <Field
        label="City"
        required={required}
        hint={loadingCities ? "Loading cities..." : undefined}
      >
        {cityLoadFailed ? (
          <Input
            name={cityName}
            required={required}
            value={selectedCity}
            onChange={(event) => setSelectedCity(event.target.value)}
            placeholder="Enter city"
          />
        ) : (
          <Select
            name={cityName}
            required={required}
            value={selectedCity}
            disabled={!selectedState || loadingCities}
            onChange={(event) => setSelectedCity(event.target.value)}
          >
            <option value="">
              {loadingCities ? "Loading cities..." : "Select city"}
            </option>
            {cities.map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </Select>
        )}
      </Field>
    </>
  );
}
