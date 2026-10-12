/** Hands the already-redacted support text to the system share sheet (mail, and the rest). */
export type LogShare = {
  share(text: string): Promise<void>;
};
