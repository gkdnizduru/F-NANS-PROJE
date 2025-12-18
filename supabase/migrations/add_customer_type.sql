-- Adds lead/customer classification to customers table
-- Note: 'type' column already exists for 'individual'/'corporate', so using 'customer_status'
alter table customers
  add column if not exists customer_status text not null default 'customer' check (customer_status in ('customer', 'lead'));

-- Backfill existing rows to customer
update customers
  set customer_status = 'customer'
  where customer_status is distinct from 'customer';
