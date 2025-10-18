// TODO-3: implement the Clustered Deferred G-buffer fragment shader

// This shader should only store G-buffer information and should not do any shading.

@group(${bindGroup_material}) @binding(0) var diffuseTex: texture_2d<f32>;
@group(${bindGroup_material}) @binding(1) var diffuseTexSampler: sampler;

struct FragmentInput
{
    @location(0) pos: vec3f,
    @location(1) nor: vec3f,
    @location(2) uv: vec2f
}

struct FragmentOut {
  @location(0) pos : vec4<f32>,
  @location(1) normal : vec4<f32>,
  @location(2) albedo : vec4<f32>,
};

@fragment
fn main(in: FragmentInput, @builtin(position) pos: vec4<f32>) -> FragmentOut
{
    var out: FragmentOut;

    let diffuseColor = textureSample(diffuseTex, diffuseTexSampler, in.uv);

    if (diffuseColor.a < 0.5f) {
        discard;
    }

    out.pos = vec4(in.pos.x, in.pos.y, in.pos.z, 1.);
    out.normal = vec4(in.nor.xyz, 1.);
    out.albedo = diffuseColor;

    return out;
}
