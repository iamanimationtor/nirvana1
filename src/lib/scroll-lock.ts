/** قفل اسکرول با شمارنده — چند لایه (منو، سبد، جستجو) با هم تداخل نمی‌کنند. */
const owners = new Set<string>();

export function scrollLock(id: string, on: boolean) {
  if (on) owners.add(id);
  else owners.delete(id);
  document.body.style.overflow = owners.size > 0 ? "hidden" : "";
}
