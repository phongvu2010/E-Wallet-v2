import { useState, useCallback, FormEvent, useMemo } from "react";
import { FormErrors } from "../utils/validators";

export type ValidationErrors<T> = FormErrors<T>;

export interface UseFormOptions<T> {
  initialValues: T;
  validate?: (values: T) => FormErrors<T>;
  onSubmit: (values: T) => Promise<void> | void;
}

export function useForm<T extends Record<string, any>>({
  initialValues,
  validate,
  onSubmit,
}: UseFormOptions<T>) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<FormErrors<T>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = useCallback(
    (currentValues: T = values): boolean => {
      if (!validate) return true;
      const currentErrors = validate(currentValues);
      setErrors(currentErrors);
      return Object.keys(currentErrors).length === 0;
    },
    [validate, values]
  );

  const setFieldValue = useCallback(
    (field: keyof T, value: any) => {
      setValues((prev) => {
        const next = { ...prev, [field]: value };
        if (validate && touched[field]) {
          const nextErrors = validate(next);
          setErrors((errs) => ({
            ...errs,
            [field]: nextErrors[field as string],
          }));
        }
        return next;
      });
    },
    [validate, touched]
  );

  const setFieldTouched = useCallback((field: keyof T, isTouched = true) => {
    setTouched((prev) => ({ ...prev, [field]: isTouched }));
  }, []);

  const setFieldError = useCallback((field: keyof T, errorMsg?: string) => {
    setErrors((prev) => ({ ...prev, [field]: errorMsg }));
  }, []);

  const clearFieldError = useCallback((field: keyof T) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field as string];
      return next;
    });
  }, []);

  const handleChange = useCallback(
    (field: keyof T) =>
      (
        e: React.ChangeEvent<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >
      ) => {
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
          [field]: currentErrors[field as string],
        }));
      }
    },
    [validate, values]
  );

  const resetForm = useCallback(
    (customValues?: T) => {
      setValues(customValues || initialValues);
      setErrors({});
      setTouched({});
      setIsSubmitting(false);
    },
    [initialValues]
  );

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

  const isValid = useMemo(() => {
    return Object.values(errors).every((err) => !err);
  }, [errors]);

  const getFieldProps = useCallback(
    (field: keyof T) => ({
      value: values[field],
      onChange: handleChange(field),
      onBlur: handleBlur(field),
      error: touched[field] ? errors[field as string] : undefined,
    }),
    [values, handleChange, handleBlur, touched, errors]
  );

  return {
    values,
    errors,
    touched,
    isValid,
    isSubmitting,
    setValues,
    setFieldValue,
    setFieldTouched,
    setFieldError,
    clearFieldError,
    handleChange,
    handleBlur,
    resetForm,
    handleSubmit,
    getFieldProps,
  };
}
