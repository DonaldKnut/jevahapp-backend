# Socket typing indicators (frontend)

Ephemeral typing signals — **not** persisted to Mongo.

## Join rooms first

```js
socket.emit("join-media", mediaId);
// and/or
socket.emit("join-content", { contentId, contentType }); // media | devotional | prayer | forum
```

## Emit typing

Legacy (media only):

```js
socket.emit("typing-start", mediaId);
socket.emit("typing-stop", mediaId);
```

Content rooms:

```js
socket.emit("typing-start", { contentId, contentType: "media" });
socket.emit("typing-stop", { contentId, contentType: "media" });
```

## Listen

```js
socket.on("user-typing", ({ userId, firstName, isTyping }) => {
  // Show/hide indicator. Exclude self (server already excludes the typer via socket.to).
});
```

## Server TTL

If the client never sends `typing-stop`, the server clears `isTyping: false` after ~3s (`TYPING_TTL_MS`).
