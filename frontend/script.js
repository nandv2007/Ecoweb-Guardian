async function scanWebsite() {

    const input = document.getElementById("urlInput");
    const button = document.getElementById("scanButton");

    const loading = document.getElementById("loading");
    const results = document.getElementById("results");
    const error = document.getElementById("error");

    const url = input.value.trim();

    // Clear previous error
    error.classList.add("hidden");


    // Validate input
    if (!url) {

        error.textContent = "Please enter a website URL.";

        error.classList.remove("hidden");

        results.classList.add("hidden");

        return;
    }


    // Start loading state
    loading.classList.remove("hidden");

    results.classList.add("hidden");

    button.disabled = true;

    button.querySelector("span").textContent = "Scanning...";


    try {

        /*
         * Production backend deployed on Render
         */

        const response = await fetch(
            "https://ecoweb-guardian-api.onrender.com/api/scan",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    url: url
                })
            }
        );


        const data = await response.json();


        if (!response.ok) {

            throw new Error(
                data.error || "Scanning failed"
            );
        }


        /*
         * Website URL
         */

        document.getElementById(
            "scannedUrl"
        ).textContent = data.url || url;


        /*
         * Sustainability score
         */

        const score =
            Number(data.sustainabilityScore) || 0;

        document.getElementById(
            "score"
        ).textContent = score;


        document.getElementById(
            "scoreBar"
        ).style.width =
            `${Math.max(0, Math.min(score, 100))}%`;


        /*
         * Score description
         */

        const scoreDescription =
            document.getElementById("scoreDescription");


        if (score >= 80) {

            scoreDescription.textContent =
                "Excellent — the website has relatively low image optimization impact.";

        } else if (score >= 60) {

            scoreDescription.textContent =
                "Good — there are some opportunities to reduce image weight.";

        } else if (score >= 40) {

            scoreDescription.textContent =
                "Needs improvement — several optimization opportunities were detected.";

        } else {

            scoreDescription.textContent =
                "High optimization opportunity — image weight can likely be reduced significantly.";

        }


        /*
         * Image count
         */

        document.getElementById(
            "imageCount"
        ).textContent =
            data.imageCount ?? "--";


        /*
         * Total image size
         */

        if (
            typeof data.totalSizeKB === "number"
        ) {

            document.getElementById(
                "totalSize"
            ).textContent =
                `${data.totalSizeKB.toFixed(2)} KB`;

        } else {

            document.getElementById(
                "totalSize"
            ).textContent = "--";
        }


        /*
         * Potential savings
         */

        if (
            typeof data.potentialSavingsKB === "number"
        ) {

            document.getElementById(
                "savings"
            ).textContent =
                `${data.potentialSavingsKB.toFixed(2)} KB`;

        } else {

            document.getElementById(
                "savings"
            ).textContent = "--";
        }


        /*
         * Savings percentage
         */

        if (
            typeof data.savingsPercent === "number"
        ) {

            document.getElementById(
                "percentage"
            ).textContent =
                `${data.savingsPercent.toFixed(2)}%`;

        } else {

            document.getElementById(
                "percentage"
            ).textContent = "--";
        }


        /*
         * Show results
         */

        results.classList.remove("hidden");


        /*
         * Smoothly scroll to results
         */

        setTimeout(() => {

            results.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        }, 100);


    } catch (err) {

        console.error("EcoWeb Guardian scan error:", err);


        error.textContent =
            "Unable to scan website: " +
            err.message;


        error.classList.remove("hidden");

        results.classList.add("hidden");


    } finally {

        loading.classList.add("hidden");

        button.disabled = false;

        button.querySelector(
            "span"
        ).textContent = "Scan website";

    }
}


/*
 * Allow pressing Enter in the URL field
 */

document
    .getElementById("urlInput")
    .addEventListener("keydown", function (event) {

        if (event.key === "Enter") {

            scanWebsite();

        }

    });