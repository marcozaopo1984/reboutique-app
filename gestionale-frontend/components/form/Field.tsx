'use client';

const baseControl =
  'border rounded-md px-3 py-2 w-full bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-slate-300';

export function Field(props: {
  label: string;
  required?: boolean;
  children: any;
  className?: string;
}) {
  return (
    <div className={props.className ?? 'flex flex-col'}>
      <label className="text-xs text-slate-600 mb-1">
        {props.label} {props.required ? <span className="text-red-600">*</span> : null}
      </label>
      {props.children}
    </div>
  );
}

export function Input(props: any) {
  return <input {...props} className={`${baseControl} ${props.className ?? ''}`} />;
}

export function Select(props: any) {
  return <select {...props} className={`${baseControl} ${props.className ?? ''}`} />;
}

export function Textarea(props: any) {
  return <textarea {...props} className={`${baseControl} ${props.className ?? ''}`} />;
}
