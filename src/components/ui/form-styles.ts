/**
 * Shared inline style constants for "light" modal forms.
 *
 * Used by: AddTaskModal, AddSubjectModal, AddPublicationModal.
 *
 * NOT used by InviteModal / EditMemberModal — those use a distinct "team modal"
 * skin (borderRadius 7, rgba border, translucent background, fontSize 10 label,
 * color #2f4486 label) which is intentionally different and stays inline.
 */

export const FORM_INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  borderRadius: 5,
  border: '1px solid #eceadf',
  background: '#fff',
  fontFamily: 'IBM Plex Mono, monospace',
  fontSize: 12,
  color: '#2a3457',
  outline: 'none',
}

export const FORM_LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontFamily: 'IBM Plex Mono, monospace',
  fontSize: 9,
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#5768ac',
  marginBottom: 5,
}

export const FORM_BTN_CANCEL_STYLE: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 6,
  border: '1px solid #eceadf',
  background: 'transparent',
  fontFamily: 'IBM Plex Mono, monospace',
  fontSize: 11,
  color: '#7e95d6',
  cursor: 'pointer',
}

export const FORM_BTN_SUBMIT_STYLE: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 6,
  border: 'none',
  background: '#2f4486',
  color: '#fff',
  fontFamily: 'IBM Plex Mono, monospace',
  fontSize: 11,
}
