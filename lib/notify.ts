import Notification from "@/models/Notification";

/**
 * Fire-and-forget in-app notification. Target a specific user (userEmail)
 * or everyone with a role (roleTarget). Never throws into the caller.
 */
export function notify(params: {
  userEmail?: string;
  roleTarget?: string;
  title: string;
  body?: string;
  link?: string;
}): void {
  if (!params.userEmail && !params.roleTarget) return;
  Notification.create({
    userEmail: params.userEmail?.toLowerCase(),
    roleTarget: params.roleTarget,
    title: params.title,
    body: params.body,
    link: params.link,
  }).catch(() => {});
}
