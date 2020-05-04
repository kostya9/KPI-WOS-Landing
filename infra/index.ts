import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

import * as fs from "fs";
import * as mime from "mime";
import * as path from "path";

const stackConfig = new pulumi.Config("site");
const domain = stackConfig.require("domain");
const certArn = stackConfig.require("certificateArn");


// Create an AWS resource (S3 Bucket)
const bucket = new aws.s3.Bucket(domain, {
    acl: "public-read",

    // Configure S3 to serve bucket contents as a website. This way S3 will automatically convert
    // requests for "foo/" to "foo/index.html".
    website: {
        indexDocument: "index.html"
    }
});

const hour = 60 * 60 + 1;

const cloudfrontDistribution = new aws.cloudfront.Distribution("static-woss", {
    enabled: true,
    aliases: [domain],
    defaultRootObject: "index.html",
    defaultCacheBehavior: {
        targetOriginId: bucket.arn,

        viewerProtocolPolicy: "redirect-to-https",
        allowedMethods: ["GET", "HEAD", "OPTIONS"],
        cachedMethods: ["GET", "HEAD", "OPTIONS"],

        forwardedValues: {
            cookies: { forward: "none" },
            queryString: false,
        },

        minTtl: 0,
        defaultTtl: 0,
        maxTtl: 0,
    },

    priceClass: "PriceClass_100",

    // You can customize error responses. When CloudFront recieves an error from the origin (e.g. S3 or some other
    // web service) it can return a different error code, and return the response for a different resource.
    customErrorResponses: [
        { errorCode: 404, responseCode: 404, responsePagePath: "/404.html" },
    ],

    restrictions: {
        geoRestriction: {
            restrictionType: "none",
        },
    },

    viewerCertificate: {
        acmCertificateArn: certArn,  // Per AWS, ACM certificate must be in the us-east-1 region.
        sslSupportMethod: "sni-only",
    },
    // We only specify one origin for this distribution, the S3 content bucket.
    origins: [
        {
            originId: bucket.arn,
            domainName: bucket.websiteEndpoint,
            customOriginConfig: {
                // Amazon S3 doesn't support HTTPS connections when using an S3 bucket configured as a website endpoint.
                // https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-web-values-specify.html#DownloadDistValuesOriginProtocolPolicy
                originProtocolPolicy: "http-only",
                httpPort: 80,
                httpsPort: 443,
                originSslProtocols: ["TLSv1.2"],
            },
        },
    ],
});

function* recursiveFiles(dir: string): Generator<string> {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            yield* recursiveFiles(filePath);
        }
        if (stat.isFile()) {
            yield filePath;
        }
    }
}

var webRootRelative = path.join("..", "www");
for(const relativeFilePath of recursiveFiles(webRootRelative)) {
    const filePath = relativeFilePath
        .replace(webRootRelative + path.sep, "")
        .replace("\\", "/");
        const contentFile = new aws.s3.BucketObject(
            filePath,
            {
                key: filePath,
                acl: "public-read",
                bucket: bucket,
                contentType: mime.getType(relativeFilePath) || undefined,
                source: new pulumi.asset.FileAsset(relativeFilePath),
            },
            {
                parent: bucket,
            });
}

// Export the name of the bucket
export const bucketName = bucket.id;
export const bucketAddress = bucket.websiteEndpoint;
export const domainUrl = cloudfrontDistribution.domainName;