-- Per-item "GST included" pricing: when true, the price the user typed
-- (entered_unit_price) already contains GST and unit_price holds the
-- back-calculated pre-tax price. Existing rows were entered pre-tax, so they
-- are marked gst_included = false with entered_unit_price = unit_price.
alter table invoice_items add column if not exists gst_included boolean not null default true;
alter table invoice_items add column if not exists entered_unit_price numeric;
update invoice_items set gst_included = false, entered_unit_price = unit_price where entered_unit_price is null;
