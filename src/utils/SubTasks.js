// The subtask editor leaves blank rows behind (adding one always opens a fresh
// row to type into), so subtasks with no text are dropped before a task is
// saved or shown. Children of a dropped row move up to its nearest kept
// ancestor, so a named nested subtask is never lost with its blank parent.
export const removeEmptySubTasks = tasks => {
  const isEmpty = task => !task.name?.trim()
  if (!tasks?.some(isEmpty)) return tasks

  const byId = new Map(tasks.map(task => [task.id, task]))
  const childrenOf = id =>
    tasks
      .filter(task => task.parentId === id)
      .sort((a, b) => a.orderId - b.orderId)

  // Position of each task in the original tree, so promoted children take the
  // place of the row they were nested under.
  const position = new Map()
  const visit = task => {
    if (position.has(task.id)) return
    position.set(task.id, position.size)
    childrenOf(task.id).forEach(visit)
  }
  tasks
    .filter(task => task.parentId == null || !byId.has(task.parentId))
    .sort((a, b) => a.orderId - b.orderId)
    .forEach(visit)

  const keptParentId = task => {
    const seen = new Set()
    let parent = byId.get(task.parentId)
    while (parent && isEmpty(parent) && !seen.has(parent.id)) {
      seen.add(parent.id)
      parent = byId.get(parent.parentId)
    }
    return parent && !isEmpty(parent) ? parent.id : null
  }

  const nextOrderId = new Map()
  return tasks
    .filter(task => !isEmpty(task))
    .map(task => ({ ...task, parentId: keptParentId(task) }))
    .sort(
      (a, b) =>
        (position.get(a.id) ?? tasks.length) -
        (position.get(b.id) ?? tasks.length),
    )
    .map(task => {
      const orderId = nextOrderId.get(task.parentId) ?? 0
      nextOrderId.set(task.parentId, orderId + 1)
      return { ...task, orderId }
    })
}
