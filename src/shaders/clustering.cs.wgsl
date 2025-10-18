// TODO-2: implement the light clustering compute shader

// ------------------------------------
// Calculating cluster bounds:
// ------------------------------------
// For each cluster (X, Y, Z):
//     - Calculate the screen-space bounds for this cluster in 2D (XY).
//     - Calculate the depth bounds for this cluster in Z (near and far planes).
//     - Convert these screen and depth bounds into view-space coordinates.
//     - Store the computed bounding box (AABB) for the cluster.

// ------------------------------------
// Assigning lights to clusters:
// ------------------------------------
// For each cluster:
//     - Initialize a counter for the number of lights in this cluster.

//     For each light:
//         - Check if the light intersects with the cluster’s bounding box (AABB).
//         - If it does, add the light to the cluster's light list.
//         - Stop adding lights if the maximum number of lights is reached.

//     - Store the number of lights assigned to this cluster.
@group(0) @binding(0) var<uniform> camera: CameraUniforms;
@group(0) @binding(1) var<storage, read_write> lightSet: LightSet;
@group(0) @binding(2) var<storage, read_write> clusters: array<u32>;
@group(0) @binding(3) var<storage, read_write> lightIndices: array<u32>;

fn lightIntersectionTest(aabbMin: vec3f, aabbMax: vec3f, light: Light) -> bool
{
    var center = camera.viewMat * vec4(light.pos.xyz, 1);
    center.z = -center.z;

    let closestX = max(aabbMin.x, min(center.x, aabbMax.x));
    let closestY = max(aabbMin.y, min(center.y, aabbMax.y));
    let closestZ = max(aabbMin.z, min(center.z, aabbMax.z));

    let squareDistance = pow((center.x - closestX), 2) + pow((center.y - closestY), 2) + pow((center.z - closestZ), 2);

    let squareRadius = f32(${lightRadius}f * ${lightRadius}f);

    return f32(squareDistance) < f32(squareRadius);
}

fn screenToView(screen: vec4<f32>) -> vec4<f32> 
{
    let screenDimensions = vec2(${width}f, ${height}f);
    let texCoord = screen.xy / screenDimensions.xy;

    let clip = vec4(vec2(texCoord.x, 1.0 - texCoord.y)* 2.0 - 1.0, screen.z, screen.w);

    var view = camera.invProjMat * clip;

    view = view / view.w;
    view.z = -view.z;

    return view;
}

fn lineIntersectionToZPlane(A: vec3f, B: vec4<f32>, zDistance: f32) -> vec3<f32>
{
    let normal = vec3f(0.0, 0.0, 1.0);

    let ab =  B.xyz - A;

    let t = (zDistance - dot(normal, A)) / dot(normal, ab);

    let result = A + t * ab;

    return result;
}

@compute
@workgroup_size(${Wx}, ${Wy}, ${Wz})
fn main(@builtin(global_invocation_id) globalIdx: vec3u) 
{
    if (globalIdx.x >= ${Nx} || globalIdx.y >= ${Ny} || globalIdx.z >= ${Nz}) 
    {
        return;
    }

    let clusterIdx = globalIdx.x +
                     globalIdx.y * ${Nx} +
                     globalIdx.z * (${Nx} * ${Ny});

    let clusterOffset = clusterIdx * ${clusterMaxLights};

    // for each cluster, determine min max aabb boundaries in NDC space and view space
    let eyePos = vec3f(0.f, 0.f, 0.f);

    let tileX = u32(${width}) / ${Nx}u;
    let tileY = u32(${height}) / ${Ny}u;

    let minPointSS = vec4(f32(globalIdx.x) * f32(tileX), f32(globalIdx.y) * f32(tileY), -1.0, 1.0);
    let maxPointSS = vec4((f32(globalIdx.x) + 1f) * f32(tileX), (f32(globalIdx.y) + 1f) * f32(tileY), -1.0, 1.0);

    let minPointVS = screenToView(minPointSS);
    let maxPointVS = screenToView(maxPointSS);

    let tileNear = ${near}f * pow(${far}f / ${near}f, f32(globalIdx.z) / ${Nz}f );
    let tileFar = ${near}f * pow(${far}f / ${near}f, (f32(globalIdx.z) + 1f) / ${Nz}f );

    let minPointNear = lineIntersectionToZPlane(eyePos, minPointVS, tileNear );
    let minPointFar  = lineIntersectionToZPlane(eyePos, minPointVS, tileFar );
    let maxPointNear = lineIntersectionToZPlane(eyePos, maxPointVS, tileNear );
    let maxPointFar  = lineIntersectionToZPlane(eyePos, maxPointVS, tileFar );

    let aabbMin = min(min(minPointNear, minPointFar),min(maxPointNear, maxPointFar));
    let aabbMax = max(max(minPointNear, minPointFar),max(maxPointNear, maxPointFar));

    // for each light, determine if it intersects aabb

    clusters[clusterIdx] = 0; // reset each frame
    for (var lightIdx = 0u; lightIdx < lightSet.numLights; lightIdx++) 
    {
        let light = lightSet.lights[lightIdx];
        if (lightIntersectionTest(aabbMin, aabbMax, light))
        {
            if (clusters[clusterIdx] < ${clusterMaxLights})
            {
                lightIndices[clusterOffset + clusters[clusterIdx]] = lightIdx;
                clusters[clusterIdx] += 1;
            }
        }
    }
}
