import { compactFeedItem } from "../liteProfile";
import { attachPublicAuthor, shapePublicAuthor } from "../publicAuthor";

describe("publicAuthor / lite feed author", () => {
  it("shapes populated uploadedBy with FE field aliases", () => {
    const shaped = shapePublicAuthor({
      _id: "674a1b2c3d4e5f6789012345",
      firstName: "John",
      lastName: "Doe",
      avatarUpload: "https://cdn.example.com/avatars/user456.jpg",
    });
    expect(shaped).toMatchObject({
      _id: "674a1b2c3d4e5f6789012345",
      id: "674a1b2c3d4e5f6789012345",
      firstName: "John",
      lastName: "Doe",
      name: "John Doe",
      avatar: "https://cdn.example.com/avatars/user456.jpg",
      avatarUrl: "https://cdn.example.com/avatars/user456.jpg",
    });
  });

  it("prefers authorInfo names when uploadedBy is a bare id", () => {
    const out = attachPublicAuthor({
      _id: "media123",
      title: "Video Title",
      uploadedBy: "674a1b2c3d4e5f6789012345",
      authorInfo: {
        _id: "674a1b2c3d4e5f6789012345",
        firstName: "John",
        lastName: "Doe",
        avatar: "https://cdn.example.com/a.jpg",
      },
    } as any);
    expect(out.uploadedBy.firstName).toBe("John");
    expect(out.uploadedBy.id).toBe("674a1b2c3d4e5f6789012345");
    expect(out.author.lastName).toBe("Doe");
  });

  it("keeps compact uploadedBy on lite cards so FE does not show Unknown", () => {
    const lite = compactFeedItem({
      _id: "media123",
      title: "Video Title",
      fileUrl: "https://cdn.example.com/v.mp4",
      uploadedBy: "674a1b2c3d4e5f6789012345",
      authorInfo: {
        _id: "674a1b2c3d4e5f6789012345",
        firstName: "John",
        lastName: "Doe",
        avatar: "https://cdn.example.com/a.jpg",
      },
    });
    expect(lite.uploadedBy).toMatchObject({
      _id: "674a1b2c3d4e5f6789012345",
      id: "674a1b2c3d4e5f6789012345",
      firstName: "John",
      lastName: "Doe",
      avatar: "https://cdn.example.com/a.jpg",
    });
    expect(lite.author.firstName).toBe("John");
    expect(lite.likeCount).toBe(0);
    expect(lite.lite.maxVideoHeight).toBe(360);
  });
});
