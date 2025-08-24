/// <reference types="@cloudflare/workers-types" />
// @ts-ignore
import manifestJSON from "__STATIC_CONTENT_MANIFEST";

import {
    getAssetFromKV,
    mapRequestToAsset,
} from "@cloudflare/kv-asset-handler";

const assetManifest = JSON.parse(manifestJSON);

export default {
    async fetch(
        request: Request,
        env: any,
        ctx: ExecutionContext,
    ): Promise<Response> {
        const eventLike: any = {
            request,
            waitUntil(promise: Promise<any>) {
                ctx.waitUntil(promise);
            },
        };

        try {
            const options = {
                ASSET_NAMESPACE: env.__STATIC_CONTENT,
                mapRequestToAsset: (req: Request): Request => {
                    const url = new URL(req.url);
                    let assetPath = url.pathname;

                    if (assetPath === "/" || assetPath === "") {
                        assetPath = "/index.html";
                    } else if (assetPath.endsWith("/")) {
                        assetPath = `${assetPath}index.html`;
                    }

                    return mapRequestToAsset(
                        new Request(
                            new URL(
                                assetManifest[assetPath.replace(/^\/+/, "")],
                                new URL(req.url).origin,
                            ),
                            req,
                        ),
                    );
                },
            };

            return await getAssetFromKV(eventLike, options);
        } catch (err) {
            console.error(
                "[kv-asset-handler] Error fetching asset:",
                err && (err as any).stack ? (err as any).stack : err,
            );

            try {
                if (
                    request.method === "GET" &&
                    request.headers.get("accept")?.includes("text/html")
                ) {
                    console.log(
                        "[kv-asset-handler] Falling back to /404.html for HTML request",
                    );
                    return await getAssetFromKV(eventLike as any, {
                        ASSET_NAMESPACE: env.__STATIC_CONTENT,
                        mapRequestToAsset: () =>
                            mapRequestToAsset(
                                new Request(
                                    new URL(
                                        assetManifest["404.html"],
                                        new URL(request.url).origin,
                                    ),
                                    request,
                                ),
                            ),
                    });
                }
            } catch (e) {
                console.error(
                    "[kv-asset-handler] Fallback to /404.html failed:",
                    e && (e as any).stack ? (e as any).stack : e,
                );
                // fall through to 404
            }

            return new Response("Not found", { status: 404 });
        }
    },
} as ExportedHandler;
