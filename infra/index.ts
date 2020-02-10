import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

import * as fs from "fs";
import * as mime from "mime";
import * as path from "path";

const stackConfig = new pulumi.Config("static-website");


// Create an AWS resource (S3 Bucket)
const bucket = new aws.s3.Bucket("wos-landing-static-server", {
    acl: "public-read",

    // Configure S3 to serve bucket contents as a website. This way S3 will automatically convert
    // requests for "foo/" to "foo/index.html".
    website: {
        indexDocument: "index.html"
    },
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