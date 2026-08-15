const axios = require("axios");
const cheerio = require("cheerio");

/*
|--------------------------------------------------------------------------
| EcoWeb Guardian - Website Scanner
|--------------------------------------------------------------------------
| Analyzes website images and estimates optimization opportunities.
|--------------------------------------------------------------------------
*/


// ------------------------------------------------------------
// Clean and normalize URL
// ------------------------------------------------------------

function cleanUrl(inputUrl) {
    let url = inputUrl.trim();

    // Handle Markdown URLs:
    // [https://example.com](https://example.com)
    if (url.startsWith("[") && url.includes("](")) {
        const start = url.indexOf("](") + 2;
        const end = url.lastIndexOf(")");

        if (end > start) {
            url = url.substring(start, end);
        }
    }

    // Remove markdown characters
    url = url.replace(/[\[\]()]/g, "");

    // Add HTTPS if protocol is missing
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = "https://" + url;
    }

    return url;
}


// ------------------------------------------------------------
// Browser-like headers
// ------------------------------------------------------------

const browserHeaders = {
    "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151 Safari/537.36",
    "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language":
        "en-US,en;q=0.9"
};


// ------------------------------------------------------------
// Determine image format
// ------------------------------------------------------------

function detectImageFormat(imageUrl, contentType = "") {

    const type = contentType.toLowerCase();

    if (type.includes("avif")) {
        return "AVIF";
    }

    if (type.includes("webp")) {
        return "WebP";
    }

    if (type.includes("jpeg") || type.includes("jpg")) {
        return "JPEG";
    }

    if (type.includes("png")) {
        return "PNG";
    }

    if (type.includes("gif")) {
        return "GIF";
    }

    if (type.includes("svg")) {
        return "SVG";
    }

    try {

        const pathname = new URL(imageUrl).pathname.toLowerCase();

        if (pathname.endsWith(".avif")) return "AVIF";
        if (pathname.endsWith(".webp")) return "WebP";
        if (pathname.endsWith(".jpg")) return "JPEG";
        if (pathname.endsWith(".jpeg")) return "JPEG";
        if (pathname.endsWith(".png")) return "PNG";
        if (pathname.endsWith(".gif")) return "GIF";
        if (pathname.endsWith(".svg")) return "SVG";

    } catch (error) {
        // Ignore invalid URL
    }

    return "Unknown";
}


// ------------------------------------------------------------
// Estimate image optimization
// ------------------------------------------------------------

function estimateOptimization(format, sizeKB) {

    let savingsPercent = 0;

    /*
     * These are intentionally estimates.
     * They are not actual compression measurements.
     */

    switch (format) {

        case "JPEG":
            savingsPercent = 35;
            break;

        case "PNG":
            savingsPercent = 50;
            break;

        case "GIF":
            savingsPercent = 40;
            break;

        case "WebP":
            savingsPercent = 15;
            break;

        case "AVIF":
            savingsPercent = 5;
            break;

        case "SVG":
            savingsPercent = 10;
            break;

        default:
            savingsPercent = 30;
    }


    // Very small files usually have little optimization opportunity
    if (sizeKB < 20) {
        savingsPercent = Math.min(savingsPercent, 5);
    }


    const estimatedSavingsKB =
        sizeKB * (savingsPercent / 100);


    return {
        savingsPercent,
        estimatedSavingsKB
    };
}


// ------------------------------------------------------------
// Analyze a single image
// ------------------------------------------------------------

async function analyzeImage(imageUrl) {

    try {

        let response;

        /*
         * First try HEAD.
         * This is much faster than downloading the image.
         */

        try {

            response = await axios.head(imageUrl, {

                headers: {
                    "User-Agent": browserHeaders["User-Agent"],
                    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
                },

                timeout: 10000,

                maxRedirects: 5,

                validateStatus: (status) =>
                    status >= 200 && status < 400

            });

        } catch (headError) {

            /*
             * Some servers do not support HEAD.
             *
             * We perform a lightweight GET request as fallback.
             */

            response = await axios.get(imageUrl, {

                headers: {
                    "User-Agent": browserHeaders["User-Agent"],
                    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
                },

                timeout: 15000,

                maxRedirects: 5,

                responseType: "stream",

                validateStatus: (status) =>
                    status >= 200 && status < 400

            });

            /*
             * Count the downloaded bytes.
             */

            let bytes = 0;

            await new Promise((resolve, reject) => {

                response.data.on("data", chunk => {
                    bytes += chunk.length;
                });

                response.data.on("end", resolve);

                response.data.on("error", reject);

            });

            response.headers["content-length"] = bytes;
        }


        const contentLength =
            parseInt(
                response.headers["content-length"] || "0",
                10
            );


        const contentType =
            response.headers["content-type"] || "unknown";


        const sizeKB =
            contentLength / 1024;


        const format =
            detectImageFormat(
                imageUrl,
                contentType
            );


        const optimization =
            estimateOptimization(
                format,
                sizeKB
            );


        /*
         * Identify large images.
         */

        let sizeCategory = "Small";

        if (sizeKB >= 1000) {
            sizeCategory = "Very Large";
        } else if (sizeKB >= 500) {
            sizeCategory = "Large";
        } else if (sizeKB >= 200) {
            sizeCategory = "Medium";
        }


        /*
         * Generate recommendation.
         */

        let recommendation =
            "Image appears reasonably optimized.";


        if (sizeKB >= 1000) {

            recommendation =
                "High priority: compress this large image and consider WebP or AVIF.";

        } else if (format === "PNG" && sizeKB >= 200) {

            recommendation =
                "Consider converting this PNG to WebP or AVIF.";

        } else if (format === "JPEG" && sizeKB >= 200) {

            recommendation =
                "Compress this JPEG and consider serving it as WebP or AVIF.";

        } else if (format === "GIF") {

            recommendation =
                "Consider replacing GIF with WebP or AVIF where appropriate.";

        } else if (format === "Unknown") {

            recommendation =
                "Review this image format and consider using a modern format.";

        } else if (format === "WebP" || format === "AVIF") {

            recommendation =
                "Modern image format detected. Further compression may still be possible.";

        }


        return {

            url: imageUrl,

            contentType,

            format,

            sizeKB: Number(
                sizeKB.toFixed(2)
            ),

            sizeCategory,

            estimatedSavingsPercent:
                Number(
                    optimization.savingsPercent.toFixed(2)
                ),

            estimatedSavingsKB:
                Number(
                    optimization.estimatedSavingsKB.toFixed(2)
                ),

            recommendation

        };

    } catch (error) {

        console.log(
            "Unable to analyze image:",
            imageUrl
        );

        return {

            url: imageUrl,

            contentType: "unknown",

            format: detectImageFormat(imageUrl),

            sizeKB: 0,

            sizeCategory: "Unknown",

            estimatedSavingsPercent: 0,

            estimatedSavingsKB: 0,

            recommendation:
                "Unable to measure this image."

        };

    }

}


// ------------------------------------------------------------
// Extract an image URL from srcset
// ------------------------------------------------------------

function extractLargestFromSrcset(srcset) {

    if (!srcset) {
        return null;
    }

    const candidates =
        srcset
            .split(",")
            .map(item => item.trim())
            .filter(Boolean);


    if (candidates.length === 0) {
        return null;
    }


    /*
     * Prefer the candidate with the largest width descriptor.
     */

    let bestUrl = null;
    let bestWidth = 0;


    for (const candidate of candidates) {

        const parts =
            candidate.split(/\s+/);

        const candidateUrl =
            parts[0];

        const descriptor =
            parts[1] || "";


        const widthMatch =
            descriptor.match(/(\d+)w/);


        if (widthMatch) {

            const width =
                parseInt(
                    widthMatch[1],
                    10
                );


            if (width > bestWidth) {

                bestWidth = width;
                bestUrl = candidateUrl;

            }

        } else if (!bestUrl) {

            bestUrl = candidateUrl;

        }

    }


    return bestUrl;
}


// ------------------------------------------------------------
// Scan website
// ------------------------------------------------------------

async function scanWebsite(inputUrl) {

    try {

        const url =
            cleanUrl(inputUrl);


        console.log(
            "Scanning:",
            url
        );


        // ----------------------------------------------------
        // Download webpage
        // ----------------------------------------------------

        const response =
            await axios.get(url, {

                headers: browserHeaders,

                timeout: 15000,

                maxRedirects: 5

            });


        // ----------------------------------------------------
        // Parse HTML
        // ----------------------------------------------------

        const $ =
            cheerio.load(
                response.data
            );


        const images = [];


        // ----------------------------------------------------
        // Find <img> elements
        // ----------------------------------------------------

        $("img").each(
            (index, element) => {

                const possibleSources = [

                    $(element).attr("src"),

                    $(element).attr("data-src"),

                    $(element).attr("data-lazy-src"),

                    $(element).attr("data-original"),

                    $(element).attr("data-original-src")

                ];


                for (
                    const source
                    of possibleSources
                ) {

                    if (!source) {
                        continue;
                    }


                    try {

                        const absoluteUrl =
                            new URL(
                                source,
                                url
                            ).href;


                        images.push(
                            absoluteUrl
                        );


                        break;

                    } catch (error) {

                        console.log(
                            "Skipping invalid image URL:",
                            source
                        );

                    }

                }


                // ------------------------------------------------
                // Check srcset
                // ------------------------------------------------

                const srcset =
                    $(element).attr(
                        "srcset"
                    );


                const largestSrcset =
                    extractLargestFromSrcset(
                        srcset
                    );


                if (largestSrcset) {

                    try {

                        const absoluteSrcsetUrl =
                            new URL(
                                largestSrcset,
                                url
                            ).href;


                        images.push(
                            absoluteSrcsetUrl
                        );

                    } catch (error) {

                        console.log(
                            "Invalid srcset URL:",
                            largestSrcset
                        );

                    }

                }

            }
        );


        // ----------------------------------------------------
        // Find <source> elements inside <picture>
        // ----------------------------------------------------

        $("picture source").each(
            (index, element) => {

                const srcset =
                    $(element).attr(
                        "srcset"
                    );


                const largestSrcset =
                    extractLargestFromSrcset(
                        srcset
                    );


                if (!largestSrcset) {
                    return;
                }


                try {

                    const absoluteUrl =
                        new URL(
                            largestSrcset,
                            url
                        ).href;


                    images.push(
                        absoluteUrl
                    );

                } catch (error) {

                    console.log(
                        "Skipping invalid picture source:",
                        largestSrcset
                    );

                }

            }
        );


        // ----------------------------------------------------
        // Remove duplicates
        // ----------------------------------------------------

        const uniqueImages =
            [
                ...new Set(images)
            ];


        console.log(
            `Found ${uniqueImages.length} unique images`
        );


        // ----------------------------------------------------
        // Analyze images
        // ----------------------------------------------------

        const analyzedImages = [];


        for (
            const imageUrl
            of uniqueImages
        ) {

            console.log(
                "Analyzing image:",
                imageUrl
            );


            const result =
                await analyzeImage(
                    imageUrl
                );


            analyzedImages.push(
                result
            );

        }


        // ----------------------------------------------------
        // Calculate total image size
        // ----------------------------------------------------

        const totalSizeKB =
            analyzedImages.reduce(
                (total, image) =>
                    total + image.sizeKB,
                0
            );


        // ----------------------------------------------------
        // Calculate potential savings
        // ----------------------------------------------------

        const potentialSavingsKB =
            analyzedImages.reduce(
                (total, image) =>
                    total +
                    image.estimatedSavingsKB,
                0
            );


        const savingsPercent =
            totalSizeKB > 0
                ? (
                    potentialSavingsKB /
                    totalSizeKB
                ) * 100
                : 0;


        // ----------------------------------------------------
        // Count large images
        // ----------------------------------------------------

        const largeImages =
            analyzedImages.filter(
                image =>
                    image.sizeKB >= 500
            );


        const veryLargeImages =
            analyzedImages.filter(
                image =>
                    image.sizeKB >= 1000
            );


        // ----------------------------------------------------
        // Count formats
        // ----------------------------------------------------

        const formatCounts = {

            JPEG: 0,

            PNG: 0,

            WebP: 0,

            AVIF: 0,

            GIF: 0,

            SVG: 0,

            Unknown: 0

        };


        analyzedImages.forEach(
            image => {

                if (
                    formatCounts[
                        image.format
                    ] !== undefined
                ) {

                    formatCounts[
                        image.format
                    ]++;

                } else {

                    formatCounts.Unknown++;

                }

            }
        );


        // ----------------------------------------------------
        // Generate optimization opportunities
        // ----------------------------------------------------

        const opportunities = [];


        if (
            veryLargeImages.length > 0
        ) {

            opportunities.push({

                type: "large-images",

                priority: "High",

                title:
                    "Large image assets detected",

                description:
                    `${veryLargeImages.length} image(s) exceed 1 MB. Compressing these assets could significantly reduce page weight.`

            });

        }


        if (
            formatCounts.PNG > 0
        ) {

            opportunities.push({

                type: "png",

                priority: "Medium",

                title:
                    "PNG optimization opportunity",

                description:
                    `${formatCounts.PNG} PNG image(s) detected. Consider WebP or AVIF where transparency or lossless quality requirements allow.`

            });

        }


        if (
            formatCounts.JPEG > 0
        ) {

            opportunities.push({

                type: "jpeg",

                priority: "Medium",

                title:
                    "JPEG optimization opportunity",

                description:
                    `${formatCounts.JPEG} JPEG image(s) detected. Modern formats such as WebP or AVIF can often reduce transfer size.`

            });

        }


        if (
            formatCounts.GIF > 0
        ) {

            opportunities.push({

                type: "gif",

                priority: "Medium",

                title:
                    "GIF optimization opportunity",

                description:
                    `${formatCounts.GIF} GIF image(s) detected. Animated or static GIF assets may be replaceable with more efficient formats.`

            });

        }


        if (
            savingsPercent >= 30
        ) {

            opportunities.push({

                type: "overall-reduction",

                priority: "High",

                title:
                    "Significant reduction potential",

                description:
                    `Estimated image optimization could reduce image payload by approximately ${savingsPercent.toFixed(1)}%.`

            });

        }


        if (
            opportunities.length === 0
        ) {

            opportunities.push({

                type: "good",

                priority: "Low",

                title:
                    "No major image issues detected",

                description:
                    "The scanned image assets appear reasonably optimized based on the available measurements."

            });

        }


        // ----------------------------------------------------
        // Sustainability score
        // ----------------------------------------------------

        /*
         * Current score is intentionally simple.
         *
         * Higher estimated image savings =
         * greater optimization opportunity =
         * lower sustainability score.
         */

        let sustainabilityScore =
            100 - savingsPercent;


        /*
         * Apply a small penalty for very large images.
         */

        if (
            veryLargeImages.length > 0
        ) {

            sustainabilityScore -=
                Math.min(
                    veryLargeImages.length * 2,
                    10
                );

        }


        sustainabilityScore =
            Math.max(
                0,
                Math.min(
                    100,
                    sustainabilityScore
                )
            );


        // ----------------------------------------------------
        // Final result
        // ----------------------------------------------------

        return {

            url,

            imageCount:
                uniqueImages.length,

            totalSizeKB:
                Number(
                    totalSizeKB.toFixed(2)
                ),

            potentialSavingsKB:
                Number(
                    potentialSavingsKB.toFixed(2)
                ),

            savingsPercent:
                Number(
                    savingsPercent.toFixed(2)
                ),

            sustainabilityScore:
                Number(
                    sustainabilityScore.toFixed(0)
                ),

            largeImageCount:
                largeImages.length,

            veryLargeImageCount:
                veryLargeImages.length,

            formatCounts,

            optimizationOpportunities:
                opportunities,

            images:
                analyzedImages

        };

    } catch (error) {

        console.error(
            "Error scanning website:",
            error.message
        );


        throw new Error(
            `Unable to scan website: ${error.message}`
        );

    }

}


// ------------------------------------------------------------
// Export scanner
// ------------------------------------------------------------

module.exports =
    scanWebsite;