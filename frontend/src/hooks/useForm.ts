import { useState, useCallback, FormEvent } from "react";

export type ValidationErrors<T> = Partial<Record<keyof T, string>>;

export interface UseFormOptions<T> {
  initialValues: T;
  validate?: (values: T) => ValidationErrors<T>;
  onSubmit: (values: T) => Promise<void> | void;
}

export function useForm<T extends Record<string, any>>({
  initialValues,
  validate,
  onSubmit,
}: UseFormOptions<T>) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<ValidationErrors<T>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = useCallback(
    (currentValues: T): boolean => {
      if (!validate) return true;
      const currentErrors = validate(currentValues);
      setErrors(currentErrors);
      return Object.keys(currentErrors).length === 0;
    },
    [validate]
  );

  const setFieldValue = useCallback(
    (field: keyof T, value: any) => {
      setValues((prev) => {
        const next = { ...prev, [field]: value };
        if (validate && touched[field]) {
          const nextErrors = validate(next);
          setErrors((errs) => ({
            ...errs,
            [field]: nextErrors[field],
          }));
        }
        return next;
      });
    },
    [validate, touched]
  );

  const handleChange = useCallback(
    (field: keyof T) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const val = e.target.value;
      setFieldValue(field, val);
    },
    [setFieldValue]
  );

  const handleBlur = useCallback(
    (field: keyof T) => () => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      if (validate) {
        const currentErrors = validate(values);
        setErrors((prev) => ({
          ...prev,
          [field]: currentErrors[field],
        }));
      }
    },
    [validate, values]
  );

  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();

    // Mark all fields as touched
    const allTouched = Object.keys(values).reduce((acc, key) => {
      acc[key as keyof T] = true;
      return acc;
    }, {} as Partial<Record<keyof T, boolean>>);
    setTouched(allTouched);

    const isFormValid = validateForm(values);
    if (!isFormValid) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = Object.keys(errors).length === 0;

  return {
    values,
    errors,
    touched,
    isValid,
    isSubmitting,
    setValues,
    setFieldValue,
    handleChange,
    handleBlur,
    resetForm,
    handleSubmit,
  };
}
