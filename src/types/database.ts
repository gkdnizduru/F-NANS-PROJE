export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          company_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          company_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          company_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_profiles: {
        Row: {
          user_id: string
          company_name: string | null
          logo_url: string | null
          contact_name: string | null
          contact_email: string | null
          contact_phone: string | null
          address: string | null
          website: string | null
        }
        Insert: {
          user_id: string
          company_name?: string | null
          logo_url?: string | null
          contact_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          address?: string | null
          website?: string | null
        }
        Update: {
          user_id?: string
          company_name?: string | null
          logo_url?: string | null
          contact_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          address?: string | null
          website?: string | null
        }
        Relationships: []
      }
      activities: {
        Row: {
          id: string
          user_id: string
          customer_id: string | null
          deal_id: string | null
          type: 'task' | 'meeting' | 'call' | 'email'
          subject: string
          description: string | null
          due_date: string | null
          is_completed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          customer_id?: string | null
          deal_id?: string | null
          type: 'task' | 'meeting' | 'call' | 'email'
          subject: string
          description?: string | null
          due_date?: string | null
          is_completed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          customer_id?: string | null
          deal_id?: string | null
          type?: 'task' | 'meeting' | 'call' | 'email'
          subject?: string
          description?: string | null
          due_date?: string | null
          is_completed?: boolean
          created_at?: string
        }
        Relationships: []
      }
      accounts: {
        Row: {
          id: string
          user_id: string
          name: string
          type: 'bank' | 'cash' | 'credit_card'
          currency: 'TRY' | 'USD' | 'EUR'
          balance: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type: 'bank' | 'cash' | 'credit_card'
          currency?: 'TRY' | 'USD' | 'EUR'
          balance?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: 'bank' | 'cash' | 'credit_card'
          currency?: 'TRY' | 'USD' | 'EUR'
          balance?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          id: string
          user_id: string
          name: string
          type: 'individual' | 'corporate'
          email: string | null
          phone: string | null
          address: string | null
          tax_number: string | null
          tax_office: string | null
          contact_person: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type: 'individual' | 'corporate'
          email?: string | null
          phone?: string | null
          address?: string | null
          tax_number?: string | null
          tax_office?: string | null
          contact_person?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: 'individual' | 'corporate'
          email?: string | null
          phone?: string | null
          address?: string | null
          tax_number?: string | null
          tax_office?: string | null
          contact_person?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          type: 'income' | 'expense'
          amount: number
          category: string
          description: string | null
          transaction_date: string
          customer_id: string | null
          bank_account: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: 'income' | 'expense'
          amount: number
          category: string
          description?: string | null
          transaction_date: string
          customer_id?: string | null
          bank_account?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: 'income' | 'expense'
          amount?: number
          category?: string
          description?: string | null
          transaction_date?: string
          customer_id?: string | null
          bank_account?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          user_id: string
          name: string
          type: 'income' | 'expense'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type: 'income' | 'expense'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: 'income' | 'expense'
          created_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          unit_price: number
          type: 'service' | 'product'
          sku: string | null
          stock_quantity: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          unit_price: number
          type?: 'service' | 'product'
          sku?: string | null
          stock_quantity?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          unit_price?: number
          type?: 'service' | 'product'
          sku?: string | null
          stock_quantity?: number | null
          created_at?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          id: string
          user_id: string
          customer_id: string
          quote_number: string
          issue_date: string
          expiry_date: string
          status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'converted'
          subtotal: number
          tax_rate: number
          tax_amount: number
          total_amount: number
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          customer_id: string
          quote_number: string
          issue_date: string
          expiry_date: string
          status?: 'draft' | 'sent' | 'accepted' | 'rejected' | 'converted'
          subtotal: number
          tax_rate: number
          tax_amount: number
          total_amount: number
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          customer_id?: string
          quote_number?: string
          issue_date?: string
          expiry_date?: string
          status?: 'draft' | 'sent' | 'accepted' | 'rejected' | 'converted'
          subtotal?: number
          tax_rate?: number
          tax_amount?: number
          total_amount?: number
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      quote_items: {
        Row: {
          id: string
          quote_id: string
          product_id: string | null
          description: string
          quantity: number
          unit_price: number
          amount: number
          created_at: string
        }
        Insert: {
          id?: string
          quote_id: string
          product_id?: string | null
          description: string
          quantity: number
          unit_price: number
          amount: number
          created_at?: string
        }
        Update: {
          id?: string
          quote_id?: string
          product_id?: string | null
          description?: string
          quantity?: number
          unit_price?: number
          amount?: number
          created_at?: string
        }
        Relationships: []
      }
      deals: {
        Row: {
          id: string
          user_id: string
          customer_id: string
          title: string
          value: number
          stage: 'new' | 'meeting' | 'proposal' | 'negotiation' | 'won' | 'lost'
          expected_close_date: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          customer_id: string
          title: string
          value: number
          stage?: 'new' | 'meeting' | 'proposal' | 'negotiation' | 'won' | 'lost'
          expected_close_date: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          customer_id?: string
          title?: string
          value?: number
          stage?: 'new' | 'meeting' | 'proposal' | 'negotiation' | 'won' | 'lost'
          expected_close_date?: string
          created_at?: string
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          id: string
          user_id: string
          message: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          message: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          message?: string
          created_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          id: string
          user_id: string
          customer_id: string
          invoice_number: string
          invoice_date: string
          due_date: string
          status: 'draft' | 'sent' | 'paid' | 'cancelled'
          subtotal: number
          tax_amount: number
          total_amount: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          customer_id: string
          invoice_number: string
          invoice_date: string
          due_date: string
          status?: 'draft' | 'sent' | 'paid' | 'cancelled'
          subtotal: number
          tax_amount: number
          total_amount: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          customer_id?: string
          invoice_number?: string
          invoice_date?: string
          due_date?: string
          status?: 'draft' | 'sent' | 'paid' | 'cancelled'
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          id: string
          invoice_id: string
          description: string
          quantity: number
          unit_price: number
          tax_rate: number
          amount: number
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          description: string
          quantity: number
          unit_price: number
          tax_rate?: number
          amount: number
          created_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          description?: string
          quantity?: number
          unit_price?: number
          tax_rate?: number
          amount?: number
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
