import { InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react'

interface BaseProps {
  id?: string
  label: string
  error?: string
  hint?: string
  required?: boolean
  className?: string
}

type InputProps = BaseProps &
  InputHTMLAttributes<HTMLInputElement> & {
    as?: 'input'
  }

type SelectProps = BaseProps &
  SelectHTMLAttributes<HTMLSelectElement> & {
    as: 'select'
    children: ReactNode
  }

type TextareaProps = BaseProps &
  InputHTMLAttributes<HTMLTextAreaElement> & {
    as: 'textarea'
    rows?: number
  }

type FormFieldProps = InputProps | SelectProps | TextareaProps

export default function FormField(props: FormFieldProps) {
  const { id, label, error, hint, required, className = '', as = 'input', ...rest } = props

  const baseInputClass =
    'block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm ' +
    'placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 ' +
    'focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500 ' +
    (error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : '')

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      {as === 'select' ? (
        <select
          id={id}
          className={baseInputClass}
          {...(rest as SelectHTMLAttributes<HTMLSelectElement>)}
        >
          {(props as SelectProps).children}
        </select>
      ) : as === 'textarea' ? (
        <textarea
          id={id}
          rows={(props as TextareaProps).rows ?? 3}
          className={baseInputClass}
          {...(rest as InputHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input
          id={id}
          className={baseInputClass}
          {...(rest as InputHTMLAttributes<HTMLInputElement>)}
        />
      )}

      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
