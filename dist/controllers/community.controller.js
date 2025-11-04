"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCommunityModules = void 0;
const getCommunityModules = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const modules = [
            {
                id: "prayer-wall",
                title: "Prayer Wall",
                description: "Share and receive prayers",
                icon: "prayer",
                enabled: true,
            },
            {
                id: "forum",
                title: "Forum",
                description: "Community discussions",
                icon: "forum",
                enabled: true,
            },
            {
                id: "polls",
                title: "Polls",
                description: "Community polls and surveys",
                icon: "polls",
                enabled: true,
            },
            {
                id: "groups",
                title: "Groups",
                description: "Join or create groups",
                icon: "groups",
                enabled: true,
            },
        ];
        res.status(200).json({ success: true, modules });
    }
    catch (error) {
        console.error("Get community modules error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve community modules",
        });
    }
});
exports.getCommunityModules = getCommunityModules;
