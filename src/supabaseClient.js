import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qaophcxaazldbxrvnwuo.supabase.co'
const supabaseAnonKey = 'sb_publishable_9EqgHxfnMJOzHUEsnxArWw_LyEfLuex' // Pega aquí tu Publishable key completa de Supabase

export const supabase = createClient(supabaseUrl, supabaseAnonKey)