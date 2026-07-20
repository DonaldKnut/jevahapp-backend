# Push Notifications (Expo)

Mobile contract for closed-app delivery on iOS and Android via Expo Push.

## Prerequisites

- Expo / EAS project with push credentials configured
- Backend `EXPO_ACCESS_TOKEN` set on **API and worker** (see [SETUP.md](./SETUP.md))
- User authenticated with Bearer JWT

## Flow

1. Request OS notification permission
2. Obtain Expo push token (`ExpoPushToken[...]`)
3. Register with the API
4. Handle notification taps via deep-link `data` payload

```text
App → permission → getExpoPushTokenAsync
  → POST /api/push-notifications/register { deviceToken }
  ← Worker sends via Expo → device (foreground / background / killed)
  → tap opens app with data payload
```

## Register device

```http
POST /api/push-notifications/register
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "deviceToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
}
```

Success:

```json
{ "success": true, "message": "Device token registered successfully" }
```

Unregister:

```http
POST /api/push-notifications/unregister
Authorization: Bearer <access_token>
Content-Type: application/json

{ "deviceToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" }
```

## Preferences and enable

```http
PUT /api/push-notifications/preferences
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "mediaLikes": true,
  "mediaComments": true,
  "newFollowers": true,
  "newMessages": true
}
```

```http
PUT /api/push-notifications/enabled
Authorization: Bearer <access_token>
Content-Type: application/json

{ "enabled": true }
```

## Deep-link `data` payload

Push messages include a `data` object. Typical keys:

| Key | Meaning |
|-----|---------|
| `notificationId` | In-app notification Mongo id |
| `type` | Event type (`like`, `comment`, `follow`, `message`, …) |
| plus metadata | e.g. content ids / actor fields from the producer |

On tap, route using `type` + related ids (do not invent URLs from tokens).

## Test send

```http
POST /api/push-notifications/test
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "title": "Test",
  "body": "Hello from Jevah",
  "data": { "test": true }
}
```

Requires a registered token and `enabled: true`.

## Server architecture (Phase 1)

- Inbox: `Notification` document
- Delivery: BullMQ `notifications` queue → Expo API
- Device registry: `PushDevice` (unique Expo token) synced with legacy `User.pushNotifications.deviceTokens`
- Tickets: `PushDelivery` rows for receipt reconciliation
- Outbox: `NotificationOutbox` model (for durable retry / publisher)
- Worker polls Expo receipts and deactivates `DeviceNotRegistered` tokens

Routes under `/api/push-notifications` are unchanged.
