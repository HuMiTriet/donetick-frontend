// The backend answers failures with { error: "..." }. Returns that message,
// or the fallback when the body has none (or isn't JSON).
export const serverErrorMessage = async (response, fallback) => {
  try {
    const body = await response?.json()
    if (typeof body?.error === 'string' && body.error.trim() !== '') {
      return body.error
    }
  } catch {
    // empty or non-JSON body: use the fallback
  }
  return fallback
}

// HTTP 423: a Beeminder stake has locked the chore against changes.
export const isStakeLockedResponse = response => response?.status === 423
