-- Canonicalize legacy workspace date values so compatibility JSON always matches the strict CRM date contract.
CREATE OR REPLACE FUNCTION crm_canonical_date_value(value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  raw TEXT:=btrim(value);
  y INTEGER;
  m INTEGER;
  d INTEGER;
BEGIN
  IF raw IS NULL OR raw='' THEN RETURN raw; END IF;
  IF raw ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN
    y:=substring(raw,1,4)::INTEGER;
    m:=substring(raw,6,2)::INTEGER;
    d:=substring(raw,9,2)::INTEGER;
    PERFORM make_date(y,m,d);
    RETURN substring(raw,1,10);
  END IF;
  RETURN raw;
EXCEPTION WHEN OTHERS THEN
  RETURN raw;
END $$;
-- statement-break
CREATE OR REPLACE FUNCTION crm_json_date_fields(items JSONB, required_keys TEXT[], optional_keys TEXT[])
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  item JSONB;
  result JSONB:='[]'::JSONB;
  key TEXT;
  raw TEXT;
  canonical TEXT;
BEGIN
  IF items IS NULL OR jsonb_typeof(items)<>'array' THEN RETURN COALESCE(items,'[]'::JSONB); END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(items) LOOP
    FOREACH key IN ARRAY required_keys LOOP
      raw:=item->>key;
      IF raw IS NOT NULL THEN
        canonical:=crm_canonical_date_value(raw);
        IF canonical<>raw THEN item:=jsonb_set(item,ARRAY[key],to_jsonb(canonical),TRUE); END IF;
      END IF;
    END LOOP;
    FOREACH key IN ARRAY optional_keys LOOP
      IF item ? key THEN
        raw:=item->>key;
        IF raw IS NULL OR btrim(raw)='' THEN
          item:=item-key;
        ELSE
          canonical:=crm_canonical_date_value(raw);
          IF canonical<>raw THEN item:=jsonb_set(item,ARRAY[key],to_jsonb(canonical),TRUE); END IF;
        END IF;
      END IF;
    END LOOP;
    result:=result||jsonb_build_array(item);
  END LOOP;
  RETURN result;
END $$;
-- statement-break
CREATE OR REPLACE FUNCTION crm_json_nested_date_fields(items JSONB, nested_key TEXT, required_keys TEXT[], optional_keys TEXT[])
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  item JSONB;
  result JSONB:='[]'::JSONB;
BEGIN
  IF items IS NULL OR jsonb_typeof(items)<>'array' THEN RETURN COALESCE(items,'[]'::JSONB); END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(items) LOOP
    IF item ? nested_key THEN
      item:=jsonb_set(item,ARRAY[nested_key],crm_json_date_fields(item->nested_key,required_keys,optional_keys),TRUE);
    END IF;
    result:=result||jsonb_build_array(item);
  END LOOP;
  RETURN result;
END $$;
-- statement-break
CREATE OR REPLACE FUNCTION crm_canonicalize_workspace_dates(input JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  data JSONB:=COALESCE(input,'{}'::JSONB);
  arr JSONB;
BEGIN
  data:=jsonb_set(data,'{customers}',crm_json_date_fields(data->'customers',ARRAY['created']::TEXT[],ARRAY[]::TEXT[]),TRUE);
  data:=jsonb_set(data,'{purchaseOrders}',crm_json_date_fields(data->'purchaseOrders',ARRAY['created','expected']::TEXT[],ARRAY[]::TEXT[]),TRUE);

  arr:=crm_json_date_fields(data->'batches',ARRAY['expiry','received']::TEXT[],ARRAY['dueDate','paidAt']::TEXT[]);
  arr:=crm_json_nested_date_fields(arr,'payments',ARRAY['date']::TEXT[],ARRAY[]::TEXT[]);
  data:=jsonb_set(data,'{batches}',arr,TRUE);

  data:=jsonb_set(data,'{stockAdjustments}',crm_json_date_fields(data->'stockAdjustments',ARRAY['date']::TEXT[],ARRAY[]::TEXT[]),TRUE);
  data:=jsonb_set(data,'{inventoryHolds}',crm_json_date_fields(data->'inventoryHolds',ARRAY['date']::TEXT[],ARRAY['releasedAt']::TEXT[]),TRUE);

  arr:=crm_json_date_fields(data->'orders',ARRAY['created']::TEXT[],ARRAY['delivered','returnedAt','settledAt']::TEXT[]);
  arr:=crm_json_nested_date_fields(arr,'collections',ARRAY['date']::TEXT[],ARRAY[]::TEXT[]);
  data:=jsonb_set(data,'{orders}',arr,TRUE);

  data:=jsonb_set(data,'{expenses}',crm_json_date_fields(data->'expenses',ARRAY['date']::TEXT[],ARRAY[]::TEXT[]),TRUE);
  data:=jsonb_set(data,'{cashEntries}',crm_json_date_fields(data->'cashEntries',ARRAY['date']::TEXT[],ARRAY[]::TEXT[]),TRUE);
  data:=jsonb_set(data,'{accountOpenings}',crm_json_date_fields(data->'accountOpenings',ARRAY['date']::TEXT[],ARRAY['statementDate']::TEXT[]),TRUE);
  data:=jsonb_set(data,'{financeCloses}',crm_json_date_fields(data->'financeCloses',ARRAY['closedAt']::TEXT[],ARRAY[]::TEXT[]),TRUE);
  data:=jsonb_set(data,'{tasks}',crm_json_date_fields(data->'tasks',ARRAY['due']::TEXT[],ARRAY['completedAt']::TEXT[]),TRUE);
  RETURN data;
END $$;
-- statement-break
UPDATE crm_workspaces
SET data=crm_canonicalize_workspace_dates(data::JSONB)::TEXT
WHERE data IS NOT NULL;
-- statement-break
CREATE TABLE IF NOT EXISTS crm_data_integrity_certifications (
  owner_id TEXT PRIMARY KEY,
  migration_version TEXT NOT NULL,
  canonicalized_at TEXT NOT NULL,
  workspace_version INTEGER NOT NULL,
  result TEXT NOT NULL
);
-- statement-break
INSERT INTO crm_data_integrity_certifications (owner_id,migration_version,canonicalized_at,workspace_version,result)
SELECT owner_id,'007_legacy_date_canonicalization',now()::TEXT,version,'canonicalized'
FROM crm_workspaces
ON CONFLICT(owner_id) DO UPDATE SET
  migration_version=EXCLUDED.migration_version,
  canonicalized_at=EXCLUDED.canonicalized_at,
  workspace_version=EXCLUDED.workspace_version,
  result=EXCLUDED.result;
